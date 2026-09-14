import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, Color, DirectionalLight,
  HalfFloatType, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial,
  OrthographicCamera, PerspectiveCamera, PlaneGeometry, RawShaderMaterial, Scene,
  UniformsUtils, Vector3, Vector4, WebGLRenderTarget,
} from 'three';
import type { BufferGeometry, Material, Texture, WebGLRenderer } from 'three';
import { OutputShader } from 'three/addons/shaders/OutputShader.js';
import { BUTTONS, SHELLS, validateConfig } from '../config/config';
import type { Configuration } from '../config/config';
import { ASSEMBLY_PARTS } from './assembly';
import { fitDistance } from './framing';
import { makeScreenTexture } from './textures';

const WIDTH = 1600;
const HEIGHT = 1200;

/** Capture a separate assembled product scene, without resizing the live canvas.
 * Shared model geometry, grain and environment textures remain source-owned.
 */
export async function exportDevicePng(renderer: WebGLRenderer, sourceScene: Scene, config: Configuration): Promise<Blob> {
  const source = sourceScene.getObjectByName('Handheld');
  if (!source) throw new Error('The handheld is still loading. Try exporting when it appears.');
  if (renderer.getContext().isContextLost()) throw new Error('The 3D viewer lost its graphics connection. Reload the viewer before exporting.');
  const valid = validateConfig(config);
  if (!valid) throw new Error('This configuration could not be exported. Choose its colors again.');
  if (renderer.capabilities.maxTextureSize < WIDTH || !renderer.extensions.has('EXT_color_buffer_float')) {
    throw new Error('This browser cannot create the high-resolution image. Try another browser.');
  }

  const state = {
    target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), mip: renderer.getActiveMipmapLevel(),
    clear: renderer.getClearColor(new Color()), alpha: renderer.getClearAlpha(),
    viewport: renderer.getViewport(new Vector4()), scissor: renderer.getScissor(new Vector4()),
    scissorTest: renderer.getScissorTest(), xr: renderer.xr.enabled,
    toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, colorSpace: renderer.outputColorSpace,
    autoClear: renderer.autoClear, autoClearColor: renderer.autoClearColor,
    autoClearDepth: renderer.autoClearDepth, autoClearStencil: renderer.autoClearStencil,
  };
  const materials = new Set<Material>();
  const geometries: BufferGeometry[] = [];
  const textures: Texture[] = [];
  const targets = new Set<WebGLRenderTarget>();
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

  // All GPU work is synchronous. Restore renderer state before asynchronous PNG
  // encoding so a game frame or an orbit cannot render into the export buffer.
  try {
    const scene = new Scene();
    scene.environment = sourceScene.environment;
    scene.environmentIntensity = sourceScene.environmentIntensity;
    scene.environmentRotation.copy(sourceScene.environmentRotation);
    const model = source.clone(true);
    for (const part of ASSEMBLY_PARTS) model.getObjectByName(part.node)?.position.set(0, 0, 0);
    const boot = makeScreenTexture();
    textures.push(boot);
    const copies = new Map<Material, Material>();
    const translucent = valid.finish === 'translucent';
    const tint = new Color(SHELLS.find(item => item.id === valid.shell)!.hex);
    const shell = tint.clone().lerp(new Color('#ffffff'), translucent ? 0.28 : 0);
    const buttons = new Color(BUTTONS.find(item => item.id === valid.buttons)!.hex);
    const legend = new Color(valid.buttons === 'ivory' ? '#333b37' : '#e5e0d2');

    const linear = new WebGLRenderTarget(WIDTH, HEIGHT, { type: HalfFloatType, samples: 2 });
    const output = new WebGLRenderTarget(WIDTH, HEIGHT, { depthBuffer: false, stencilBuffer: false });
    targets.add(linear); targets.add(output);

    model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const names: string[] = Array.isArray(object.userData.batchedParts) ? object.userData.batchedParts : [object.name];
      const internal = /_InternalBatch$/.test(object.name) || names.every(name =>
        (object.userData.assembly === 'board' && !/^(USB|Speaker)/.test(name)) || /^(CircuitBoard|InternalFrame|Battery|Chip|Contact|Mount)/.test(name));
      if (internal) object.visible = translucent;
      const originals = Array.isArray(object.material) ? object.material : [object.material];
      const cloned = originals.map(original => {
        const existing = copies.get(original);
        if (existing) return existing;
        const material = original.clone() as Material;
        materials.add(material); copies.set(original, material);
        if (material instanceof MeshStandardMaterial) {
          if (material instanceof MeshPhysicalMaterial && /^(ShellFront|ShellBack)$/.test(material.name)) {
            material.color.copy(shell); material.attenuationColor.copy(tint);
            material.transmission = translucent ? 0.76 : 0;
            material.roughness = translucent ? 0.18 : 0.43;
          }
          if (material.name === 'Controls') material.color.copy(buttons);
          if (material.name === 'KeyInk') material.color.copy(legend);
          if (material.name === 'Screen') {
            material.map = boot; material.emissiveMap = boot;
            material.color.set('#ffffff'); material.emissive.set('#ffffff'); material.emissiveIntensity = 0.3;
          }
        }
        return material;
      });
      object.material = Array.isArray(object.material) ? cloned : cloned[0];
      // Three allocates a private transmission target per scene/camera. Capture
      // only targets used by this isolated scene so repeated exports release it.
      object.onBeforeRender = () => {
        const target = renderer.getRenderTarget();
        if (target && target !== state.target && !targets.has(target)) {
          targets.add(target);
          // r180 clears transmission captures to white/0.5 when the main clear
          // is transparent. Give refraction an opaque studio backdrop instead.
          // This runs once, before the first opaque mesh in that private pass.
          renderer.setClearColor('#f1eee7', 1);
          renderer.clear(true, true, true);
        }
      };
    });
    scene.add(model);
    sourceScene.traverse(object => {
      if (!(object instanceof AmbientLight) && !(object instanceof DirectionalLight)) return;
      const light = object.clone();
      object.getWorldPosition(light.position);
      if (object instanceof DirectionalLight && light instanceof DirectionalLight) {
        object.target.getWorldPosition(light.target.position);
        scene.add(light.target);
      }
      scene.add(light);
    });

    // A small original gradient gives the isolated product a soft studio anchor.
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const shadowContext = shadowCanvas.getContext('2d');
    if (!shadowContext) throw new Error('Image creation is unavailable in this browser.');
    const gradient = shadowContext.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(40,43,36,0.32)'); gradient.addColorStop(1, 'rgba(40,43,36,0)');
    shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 128, 128);
    const shadowMap = new CanvasTexture(shadowCanvas); textures.push(shadowMap);
    const shadowGeometry = new PlaneGeometry(8.4, 4.3); geometries.push(shadowGeometry);
    const shadowMaterial = new MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
    materials.add(shadowMaterial);
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.position.y = -1.91; shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

    const camera = new PerspectiveCamera(32, WIDTH / HEIGHT, 0.1, 60);
    const direction = new Vector3(0.48, 0.38, 1).normalize();
    camera.position.copy(direction).multiplyScalar(fitDistance(direction, WIDTH / HEIGHT) * 1.02);
    camera.lookAt(0, 0, 0);

    // Ordinary render targets are linear and skip Three's final tone mapping.
    // The transparent/MSAA capture holds premultiplied linear RGB. Remove
    // coverage before the nonlinear display transform, then composite in sRGB.
    // This keeps edge/shadow coverage clean and the page's ivory color exact.
    const outputMaterial = new RawShaderMaterial({
      ...OutputShader, uniforms: UniformsUtils.clone(OutputShader.uniforms),
      fragmentShader: `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform vec3 backgroundColor;
        varying vec2 vUv;
        #include <tonemapping_pars_fragment>
        #include <colorspace_pars_fragment>
        void main() {
          vec4 pixel = texture2D(tDiffuse, vUv);
          float coverage = clamp(pixel.a, 0.0, 1.0);
          vec3 color = pixel.rgb / max(coverage, 0.000001);
          #ifdef ACES_FILMIC_TONE_MAPPING
            color = ACESFilmicToneMapping(color);
          #endif
          color = sRGBTransferOETF(vec4(color, 1.0)).rgb;
          gl_FragColor = vec4(mix(backgroundColor, color, coverage), 1.0);
        }
      `,
      defines: { SRGB_TRANSFER: '', ...(renderer.toneMapping === ACESFilmicToneMapping ? { ACES_FILMIC_TONE_MAPPING: '' } : {}) },
      depthTest: false, depthWrite: false,
    });
    materials.add(outputMaterial);
    outputMaterial.uniforms.tDiffuse.value = linear.texture;
    outputMaterial.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    outputMaterial.uniforms.backgroundColor = { value: new Vector3(241 / 255, 238 / 255, 231 / 255) };
    const quadGeometry = new PlaneGeometry(2, 2); geometries.push(quadGeometry);
    const outputScene = new Scene();
    outputScene.add(new Mesh(quadGeometry, outputMaterial));
    renderer.xr.enabled = false;
    renderer.autoClear = renderer.autoClearColor = renderer.autoClearDepth = renderer.autoClearStencil = true;
    renderer.setScissorTest(false);
    renderer.setClearColor('#000000', 0);
    renderer.setRenderTarget(linear);
    renderer.render(scene, camera);
    renderer.setRenderTarget(output);
    renderer.render(outputScene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
    renderer.readRenderTargetPixels(output, 0, 0, WIDTH, HEIGHT, pixels);
    if (renderer.getContext().isContextLost()) throw new Error('The graphics connection was interrupted. Please retry the image export.');
  } finally {
    renderer.xr.enabled = state.xr;
    renderer.toneMapping = state.toneMapping; renderer.toneMappingExposure = state.exposure; renderer.outputColorSpace = state.colorSpace;
    renderer.autoClear = state.autoClear; renderer.autoClearColor = state.autoClearColor;
    renderer.autoClearDepth = state.autoClearDepth; renderer.autoClearStencil = state.autoClearStencil;
    renderer.setClearColor(state.clear, state.alpha);
    renderer.setViewport(state.viewport); renderer.setScissor(state.scissor); renderer.setScissorTest(state.scissorTest);
    renderer.setRenderTarget(state.target, state.face, state.mip);
    targets.forEach(target => target.dispose());
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
  }

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image creation is unavailable in this browser.');
  const image = context.createImageData(WIDTH, HEIGHT);
  const stride = WIDTH * 4;
  for (let y = 0; y < HEIGHT; y++) {
    image.data.set(pixels.subarray((HEIGHT - y - 1) * stride, (HEIGHT - y) * stride), y * stride);
  }
  context.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The PNG could not be created. Please retry the export.')), 'image/png');
  });
}
