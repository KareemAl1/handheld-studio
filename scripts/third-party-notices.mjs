import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Offline generation after npm ci. Version-pinned supplements were reviewed
// against public upstream sources; generation never makes network requests.
// Entries without a shipped/upstream LICENSE retain the declared license and
// standard terms, explicitly recording the missing copyright notice.
const supplements = {
  "@react-three/fiber@9.7.0": {
    "note": "The npm package omits LICENSE. The complete license below comes from its v9.7.0 upstream tag. React reconciler copyright is retained separately.",
    "documents": [
      {
        "source": "https://raw.githubusercontent.com/pmndrs/react-three-fiber/v9.7.0/LICENSE",
        "text": "MIT License\n\nCopyright (c) 2019-2025 Poimandres\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"
      }
    ]
  },
  "maath@0.10.8": {
    "note": "The installed package and maath@0.10.8 upstream tree omit LICENSE and a copyright notice. package.json explicitly declares MIT. Standard MIT terms are reproduced below without inventing a copyright line. Source declaration: https://raw.githubusercontent.com/pmndrs/maath/626d198fbae28ba82f2f1b184db7fcafd4d23846/packages/maath/package.json . Revisit this packaging omission when upgrading.",
    "documents": [
      {
        "source": "MIT terms (permission and warranty text) from https://raw.githubusercontent.com/pmndrs/react-three-fiber/v9.7.0/LICENSE; license declaration: maath@0.10.8 package.json",
        "text": "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"
      }
    ]
  },
  "stats-gl@2.4.2": {
    "note": "The installed package declares MIT and lists author Renaud ROHLINGER. It omits LICENSE and a copyright notice. The npm registry-reported gitHead c12b2e391d5a88616e0b30f3c7f0577966426239 also omits LICENSE; its README declares MIT, while its package.json version is stale (2.3.1). Standard MIT terms are reproduced without inventing a copyright line. Metadata: https://registry.npmjs.org/stats-gl/2.4.2 ; source: https://github.com/RenaudRohlinger/stats-gl/tree/c12b2e391d5a88616e0b30f3c7f0577966426239 . Revisit this packaging omission when upgrading.",
    "documents": [
      {
        "source": "MIT terms (permission and warranty text) from https://raw.githubusercontent.com/pmndrs/react-three-fiber/v9.7.0/LICENSE; license declaration: installed stats-gl@2.4.2 package.json and README.md",
        "text": "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"
      }
    ]
  },
  "@mediapipe/tasks-vision@0.10.17": {
    "note": "The npm package omits LICENSE; package metadata and installed vision.d.ts headers explicitly declare Apache-2.0. Canonical Apache 2.0 terms and the actual installed copyright headers are included below. No corresponding v0.10.17 source tag was available; no source-version equivalence is assumed.",
    "documents": [
      {
        "source": "https://www.apache.org/licenses/LICENSE-2.0.txt (canonical text; license/version established by installed package metadata and copyright headers)",
        "text": "\n                                 Apache License\n                           Version 2.0, January 2004\n                        http://www.apache.org/licenses/\n\n   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\n\n   1. Definitions.\n\n      \"License\" shall mean the terms and conditions for use, reproduction,\n      and distribution as defined by Sections 1 through 9 of this document.\n\n      \"Licensor\" shall mean the copyright owner or entity authorized by\n      the copyright owner that is granting the License.\n\n      \"Legal Entity\" shall mean the union of the acting entity and all\n      other entities that control, are controlled by, or are under common\n      control with that entity. For the purposes of this definition,\n      \"control\" means (i) the power, direct or indirect, to cause the\n      direction or management of such entity, whether by contract or\n      otherwise, or (ii) ownership of fifty percent (50%) or more of the\n      outstanding shares, or (iii) beneficial ownership of such entity.\n\n      \"You\" (or \"Your\") shall mean an individual or Legal Entity\n      exercising permissions granted by this License.\n\n      \"Source\" form shall mean the preferred form for making modifications,\n      including but not limited to software source code, documentation\n      source, and configuration files.\n\n      \"Object\" form shall mean any form resulting from mechanical\n      transformation or translation of a Source form, including but\n      not limited to compiled object code, generated documentation,\n      and conversions to other media types.\n\n      \"Work\" shall mean the work of authorship, whether in Source or\n      Object form, made available under the License, as indicated by a\n      copyright notice that is included in or attached to the work\n      (an example is provided in the Appendix below).\n\n      \"Derivative Works\" shall mean any work, whether in Source or Object\n      form, that is based on (or derived from) the Work and for which the\n      editorial revisions, annotations, elaborations, or other modifications\n      represent, as a whole, an original work of authorship. For the purposes\n      of this License, Derivative Works shall not include works that remain\n      separable from, or merely link (or bind by name) to the interfaces of,\n      the Work and Derivative Works thereof.\n\n      \"Contribution\" shall mean any work of authorship, including\n      the original version of the Work and any modifications or additions\n      to that Work or Derivative Works thereof, that is intentionally\n      submitted to Licensor for inclusion in the Work by the copyright owner\n      or by an individual or Legal Entity authorized to submit on behalf of\n      the copyright owner. For the purposes of this definition, \"submitted\"\n      means any form of electronic, verbal, or written communication sent\n      to the Licensor or its representatives, including but not limited to\n      communication on electronic mailing lists, source code control systems,\n      and issue tracking systems that are managed by, or on behalf of, the\n      Licensor for the purpose of discussing and improving the Work, but\n      excluding communication that is conspicuously marked or otherwise\n      designated in writing by the copyright owner as \"Not a Contribution.\"\n\n      \"Contributor\" shall mean Licensor and any individual or Legal Entity\n      on behalf of whom a Contribution has been received by Licensor and\n      subsequently incorporated within the Work.\n\n   2. Grant of Copyright License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      copyright license to reproduce, prepare Derivative Works of,\n      publicly display, publicly perform, sublicense, and distribute the\n      Work and such Derivative Works in Source or Object form.\n\n   3. Grant of Patent License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      (except as stated in this section) patent license to make, have made,\n      use, offer to sell, sell, import, and otherwise transfer the Work,\n      where such license applies only to those patent claims licensable\n      by such Contributor that are necessarily infringed by their\n      Contribution(s) alone or by combination of their Contribution(s)\n      with the Work to which such Contribution(s) was submitted. If You\n      institute patent litigation against any entity (including a\n      cross-claim or counterclaim in a lawsuit) alleging that the Work\n      or a Contribution incorporated within the Work constitutes direct\n      or contributory patent infringement, then any patent licenses\n      granted to You under this License for that Work shall terminate\n      as of the date such litigation is filed.\n\n   4. Redistribution. You may reproduce and distribute copies of the\n      Work or Derivative Works thereof in any medium, with or without\n      modifications, and in Source or Object form, provided that You\n      meet the following conditions:\n\n      (a) You must give any other recipients of the Work or\n          Derivative Works a copy of this License; and\n\n      (b) You must cause any modified files to carry prominent notices\n          stating that You changed the files; and\n\n      (c) You must retain, in the Source form of any Derivative Works\n          that You distribute, all copyright, patent, trademark, and\n          attribution notices from the Source form of the Work,\n          excluding those notices that do not pertain to any part of\n          the Derivative Works; and\n\n      (d) If the Work includes a \"NOTICE\" text file as part of its\n          distribution, then any Derivative Works that You distribute must\n          include a readable copy of the attribution notices contained\n          within such NOTICE file, excluding those notices that do not\n          pertain to any part of the Derivative Works, in at least one\n          of the following places: within a NOTICE text file distributed\n          as part of the Derivative Works; within the Source form or\n          documentation, if provided along with the Derivative Works; or,\n          within a display generated by the Derivative Works, if and\n          wherever such third-party notices normally appear. The contents\n          of the NOTICE file are for informational purposes only and\n          do not modify the License. You may add Your own attribution\n          notices within Derivative Works that You distribute, alongside\n          or as an addendum to the NOTICE text from the Work, provided\n          that such additional attribution notices cannot be construed\n          as modifying the License.\n\n      You may add Your own copyright statement to Your modifications and\n      may provide additional or different license terms and conditions\n      for use, reproduction, or distribution of Your modifications, or\n      for any such Derivative Works as a whole, provided Your use,\n      reproduction, and distribution of the Work otherwise complies with\n      the conditions stated in this License.\n\n   5. Submission of Contributions. Unless You explicitly state otherwise,\n      any Contribution intentionally submitted for inclusion in the Work\n      by You to the Licensor shall be under the terms and conditions of\n      this License, without any additional terms or conditions.\n      Notwithstanding the above, nothing herein shall supersede or modify\n      the terms of any separate license agreement you may have executed\n      with Licensor regarding such Contributions.\n\n   6. Trademarks. This License does not grant permission to use the trade\n      names, trademarks, service marks, or product names of the Licensor,\n      except as required for reasonable and customary use in describing the\n      origin of the Work and reproducing the content of the NOTICE file.\n\n   7. Disclaimer of Warranty. Unless required by applicable law or\n      agreed to in writing, Licensor provides the Work (and each\n      Contributor provides its Contributions) on an \"AS IS\" BASIS,\n      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or\n      implied, including, without limitation, any warranties or conditions\n      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A\n      PARTICULAR PURPOSE. You are solely responsible for determining the\n      appropriateness of using or redistributing the Work and assume any\n      risks associated with Your exercise of permissions under this License.\n\n   8. Limitation of Liability. In no event and under no legal theory,\n      whether in tort (including negligence), contract, or otherwise,\n      unless required by applicable law (such as deliberate and grossly\n      negligent acts) or agreed to in writing, shall any Contributor be\n      liable to You for damages, including any direct, indirect, special,\n      incidental, or consequential damages of any character arising as a\n      result of this License or out of the use or inability to use the\n      Work (including but not limited to damages for loss of goodwill,\n      work stoppage, computer failure or malfunction, or any and all\n      other commercial damages or losses), even if such Contributor\n      has been advised of the possibility of such damages.\n\n   9. Accepting Warranty or Additional Liability. While redistributing\n      the Work or Derivative Works thereof, You may choose to offer,\n      and charge a fee for, acceptance of support, warranty, indemnity,\n      or other liability obligations and/or rights consistent with this\n      License. However, in accepting such obligations, You may act only\n      on Your own behalf and on Your sole responsibility, not on behalf\n      of any other Contributor, and only if You agree to indemnify,\n      defend, and hold each Contributor harmless for any liability\n      incurred by, or claims asserted against, such Contributor by reason\n      of your accepting any such warranty or additional liability.\n\n   END OF TERMS AND CONDITIONS\n\n   APPENDIX: How to apply the Apache License to your work.\n\n      To apply the Apache License to your work, attach the following\n      boilerplate notice, with the fields enclosed by brackets \"[]\"\n      replaced with your own identifying information. (Don't include\n      the brackets!)  The text should be enclosed in the appropriate\n      comment syntax for the file format. We also recommend that a\n      file or class name and description of purpose be included on the\n      same \"printed page\" as the copyright notice for easier\n      identification within third-party archives.\n\n   Copyright [yyyy] [name of copyright owner]\n\n   Licensed under the Apache License, Version 2.0 (the \"License\");\n   you may not use this file except in compliance with the License.\n   You may obtain a copy of the License at\n\n       http://www.apache.org/licenses/LICENSE-2.0\n\n   Unless required by applicable law or agreed to in writing, software\n   distributed under the License is distributed on an \"AS IS\" BASIS,\n   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n   See the License for the specific language governing permissions and\n   limitations under the License.\n"
      }
    ]
  },
  "draco3d@1.5.7": {
    "note": "The npm package omits LICENSE. The complete upstream 1.5.7 LICENSE, including its additional notices, is included conservatively, together with the installed example source copyright header. The upstream root has no separate NOTICE file.",
    "documents": [
      {
        "source": "https://raw.githubusercontent.com/google/draco/1.5.7/LICENSE",
        "text": "                                 Apache License\n                           Version 2.0, January 2004\n                        http://www.apache.org/licenses/\n\n   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\n\n   1. Definitions.\n\n      \"License\" shall mean the terms and conditions for use, reproduction,\n      and distribution as defined by Sections 1 through 9 of this document.\n\n      \"Licensor\" shall mean the copyright owner or entity authorized by\n      the copyright owner that is granting the License.\n\n      \"Legal Entity\" shall mean the union of the acting entity and all\n      other entities that control, are controlled by, or are under common\n      control with that entity. For the purposes of this definition,\n      \"control\" means (i) the power, direct or indirect, to cause the\n      direction or management of such entity, whether by contract or\n      otherwise, or (ii) ownership of fifty percent (50%) or more of the\n      outstanding shares, or (iii) beneficial ownership of such entity.\n\n      \"You\" (or \"Your\") shall mean an individual or Legal Entity\n      exercising permissions granted by this License.\n\n      \"Source\" form shall mean the preferred form for making modifications,\n      including but not limited to software source code, documentation\n      source, and configuration files.\n\n      \"Object\" form shall mean any form resulting from mechanical\n      transformation or translation of a Source form, including but\n      not limited to compiled object code, generated documentation,\n      and conversions to other media types.\n\n      \"Work\" shall mean the work of authorship, whether in Source or\n      Object form, made available under the License, as indicated by a\n      copyright notice that is included in or attached to the work\n      (an example is provided in the Appendix below).\n\n      \"Derivative Works\" shall mean any work, whether in Source or Object\n      form, that is based on (or derived from) the Work and for which the\n      editorial revisions, annotations, elaborations, or other modifications\n      represent, as a whole, an original work of authorship. For the purposes\n      of this License, Derivative Works shall not include works that remain\n      separable from, or merely link (or bind by name) to the interfaces of,\n      the Work and Derivative Works thereof.\n\n      \"Contribution\" shall mean any work of authorship, including\n      the original version of the Work and any modifications or additions\n      to that Work or Derivative Works thereof, that is intentionally\n      submitted to Licensor for inclusion in the Work by the copyright owner\n      or by an individual or Legal Entity authorized to submit on behalf of\n      the copyright owner. For the purposes of this definition, \"submitted\"\n      means any form of electronic, verbal, or written communication sent\n      to the Licensor or its representatives, including but not limited to\n      communication on electronic mailing lists, source code control systems,\n      and issue tracking systems that are managed by, or on behalf of, the\n      Licensor for the purpose of discussing and improving the Work, but\n      excluding communication that is conspicuously marked or otherwise\n      designated in writing by the copyright owner as \"Not a Contribution.\"\n\n      \"Contributor\" shall mean Licensor and any individual or Legal Entity\n      on behalf of whom a Contribution has been received by Licensor and\n      subsequently incorporated within the Work.\n\n   2. Grant of Copyright License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      copyright license to reproduce, prepare Derivative Works of,\n      publicly display, publicly perform, sublicense, and distribute the\n      Work and such Derivative Works in Source or Object form.\n\n   3. Grant of Patent License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      (except as stated in this section) patent license to make, have made,\n      use, offer to sell, sell, import, and otherwise transfer the Work,\n      where such license applies only to those patent claims licensable\n      by such Contributor that are necessarily infringed by their\n      Contribution(s) alone or by combination of their Contribution(s)\n      with the Work to which such Contribution(s) was submitted. If You\n      institute patent litigation against any entity (including a\n      cross-claim or counterclaim in a lawsuit) alleging that the Work\n      or a Contribution incorporated within the Work constitutes direct\n      or contributory patent infringement, then any patent licenses\n      granted to You under this License for that Work shall terminate\n      as of the date such litigation is filed.\n\n   4. Redistribution. You may reproduce and distribute copies of the\n      Work or Derivative Works thereof in any medium, with or without\n      modifications, and in Source or Object form, provided that You\n      meet the following conditions:\n\n      (a) You must give any other recipients of the Work or\n          Derivative Works a copy of this License; and\n\n      (b) You must cause any modified files to carry prominent notices\n          stating that You changed the files; and\n\n      (c) You must retain, in the Source form of any Derivative Works\n          that You distribute, all copyright, patent, trademark, and\n          attribution notices from the Source form of the Work,\n          excluding those notices that do not pertain to any part of\n          the Derivative Works; and\n\n      (d) If the Work includes a \"NOTICE\" text file as part of its\n          distribution, then any Derivative Works that You distribute must\n          include a readable copy of the attribution notices contained\n          within such NOTICE file, excluding those notices that do not\n          pertain to any part of the Derivative Works, in at least one\n          of the following places: within a NOTICE text file distributed\n          as part of the Derivative Works; within the Source form or\n          documentation, if provided along with the Derivative Works; or,\n          within a display generated by the Derivative Works, if and\n          wherever such third-party notices normally appear. The contents\n          of the NOTICE file are for informational purposes only and\n          do not modify the License. You may add Your own attribution\n          notices within Derivative Works that You distribute, alongside\n          or as an addendum to the NOTICE text from the Work, provided\n          that such additional attribution notices cannot be construed\n          as modifying the License.\n\n      You may add Your own copyright statement to Your modifications and\n      may provide additional or different license terms and conditions\n      for use, reproduction, or distribution of Your modifications, or\n      for any such Derivative Works as a whole, provided Your use,\n      reproduction, and distribution of the Work otherwise complies with\n      the conditions stated in this License.\n\n   5. Submission of Contributions. Unless You explicitly state otherwise,\n      any Contribution intentionally submitted for inclusion in the Work\n      by You to the Licensor shall be under the terms and conditions of\n      this License, without any additional terms or conditions.\n      Notwithstanding the above, nothing herein shall supersede or modify\n      the terms of any separate license agreement you may have executed\n      with Licensor regarding such Contributions.\n\n   6. Trademarks. This License does not grant permission to use the trade\n      names, trademarks, service marks, or product names of the Licensor,\n      except as required for reasonable and customary use in describing the\n      origin of the Work and reproducing the content of the NOTICE file.\n\n   7. Disclaimer of Warranty. Unless required by applicable law or\n      agreed to in writing, Licensor provides the Work (and each\n      Contributor provides its Contributions) on an \"AS IS\" BASIS,\n      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or\n      implied, including, without limitation, any warranties or conditions\n      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A\n      PARTICULAR PURPOSE. You are solely responsible for determining the\n      appropriateness of using or redistributing the Work and assume any\n      risks associated with Your exercise of permissions under this License.\n\n   8. Limitation of Liability. In no event and under no legal theory,\n      whether in tort (including negligence), contract, or otherwise,\n      unless required by applicable law (such as deliberate and grossly\n      negligent acts) or agreed to in writing, shall any Contributor be\n      liable to You for damages, including any direct, indirect, special,\n      incidental, or consequential damages of any character arising as a\n      result of this License or out of the use or inability to use the\n      Work (including but not limited to damages for loss of goodwill,\n      work stoppage, computer failure or malfunction, or any and all\n      other commercial damages or losses), even if such Contributor\n      has been advised of the possibility of such damages.\n\n   9. Accepting Warranty or Additional Liability. While redistributing\n      the Work or Derivative Works thereof, You may choose to offer,\n      and charge a fee for, acceptance of support, warranty, indemnity,\n      or other liability obligations and/or rights consistent with this\n      License. However, in accepting such obligations, You may act only\n      on Your own behalf and on Your sole responsibility, not on behalf\n      of any other Contributor, and only if You agree to indemnify,\n      defend, and hold each Contributor harmless for any liability\n      incurred by, or claims asserted against, such Contributor by reason\n      of your accepting any such warranty or additional liability.\n\n   END OF TERMS AND CONDITIONS\n\n   APPENDIX: How to apply the Apache License to your work.\n\n      To apply the Apache License to your work, attach the following\n      boilerplate notice, with the fields enclosed by brackets \"[]\"\n      replaced with your own identifying information. (Don't include\n      the brackets!)  The text should be enclosed in the appropriate\n      comment syntax for the file format. We also recommend that a\n      file or class name and description of purpose be included on the\n      same \"printed page\" as the copyright notice for easier\n      identification within third-party archives.\n\n   Copyright [yyyy] [name of copyright owner]\n\n   Licensed under the Apache License, Version 2.0 (the \"License\");\n   you may not use this file except in compliance with the License.\n   You may obtain a copy of the License at\n\n       http://www.apache.org/licenses/LICENSE-2.0\n\n   Unless required by applicable law or agreed to in writing, software\n   distributed under the License is distributed on an \"AS IS\" BASIS,\n   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n   See the License for the specific language governing permissions and\n   limitations under the License.\n\n--------------------------------------------------------------------------------\nFiles: docs/assets/js/ASCIIMathML.js\n\nCopyright (c) 2014 Peter Jipsen and other ASCIIMathML.js contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n\n--------------------------------------------------------------------------------\nFiles: docs/assets/css/pygments/*\n\nThis is free and unencumbered software released into the public domain.\n\nAnyone is free to copy, modify, publish, use, compile, sell, or\ndistribute this software, either in source code form or as a compiled\nbinary, for any purpose, commercial or non-commercial, and by any\nmeans.\n\nIn jurisdictions that recognize copyright laws, the author or authors\nof this software dedicate any and all copyright interest in the\nsoftware to the public domain. We make this dedication for the benefit\nof the public at large and to the detriment of our heirs and\nsuccessors. We intend this dedication to be an overt act of\nrelinquishment in perpetuity of all present and future rights to this\nsoftware under copyright law.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\nIN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR\nOTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,\nARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR\nOTHER DEALINGS IN THE SOFTWARE.\n\nFor more information, please refer to <http://unlicense.org>\n"
      }
    ]
  }
};

const bundledSupplements = [
  {
    "label": "Typr.ts bundled by troika-three-text",
    "installed": "node_modules/troika-three-text/libs/typr.factory.js",
    "marker": "fredli74/Typr.ts",
    "source": "https://raw.githubusercontent.com/fredli74/Typr.ts/58de225c855ab72d168ddd3afa13af9b27a38e9b/LICENSE (snapshot of license source linked by installed header; helper revision is not asserted)",
    "text": "The MIT License (MIT)\n\nCopyright (c) 2016 Photopea\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"
  },
  {
    "label": "WOFF2OTF bundled by troika-three-text",
    "installed": "node_modules/troika-three-text/libs/woff2otf.factory.js",
    "marker": "arty-name/woff2otf",
    "source": "https://raw.githubusercontent.com/arty-name/woff2otf/57a5bb87191c73b2aa1217ba8a742b04d6e5b68e/woff2otf.js (snapshot of license source linked by installed header; helper revision is not asserted)",
    "text": "/*\n Copyright 2012, Steffen Hanikel (https://github.com/hanikesn)\n Modified by Artemy Tregubenko, 2014 (https://github.com/arty-name/woff2otf)\n \n   Licensed under the Apache License, Version 2.0 (the \"License\");\n   you may not use this file except in compliance with the License.\n   You may obtain a copy of the License at\n\n       http://www.apache.org/licenses/LICENSE-2.0\n\n   Unless required by applicable law or agreed to in writing, software\n   distributed under the License is distributed on an \"AS IS\" BASIS,\n   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n   See the License for the specific language governing permissions and\n   limitations under the License.\n\n A tool to convert a WOFF back to a TTF/OTF font file, in pure Javascript\n*/"
  },
  {
    "label": "Unicode font resolver client v1.0.2 bundled by troika-three-text",
    "installed": "node_modules/troika-three-text/libs/unicode-font-resolver-client.factory.js",
    "marker": "@unicode-font-resolver/client v1.0.2",
    "source": "https://raw.githubusercontent.com/lojjic/unicode-font-resolver/974383af089e544f4ac4b0ba96b5f98891688e17/LICENSE (snapshot of license source linked by installed header; helper revision is not asserted)",
    "text": "MIT License\n\nCopyright (c) 2023 Jason Johnston\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n"
  }
];

const root = fileURLToPath(new URL('../', import.meta.url));
const outputPath = path.join(root, 'public/third-party-notices.txt');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1) {
  throw new Error('Usage: node scripts/third-party-notices.mjs [--check]');
}
const normalize = (value) => value.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trimEnd() + '\n';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const lockText = await readFile(path.join(root, 'package-lock.json'), 'utf8');
const lock = JSON.parse(lockText);
if (lock.lockfileVersion !== 3 || !lock.packages) {
  throw new Error('Expected an npm v3 lockfile; review the inventory logic before changing format.');
}

const groups = new Map();
const inventory = [];
const limitations = [];
function addText(label, source, text) {
  const content = normalize(text);
  if (content.length < 50) throw new Error(`Empty/truncated notice: ${source}`);
  const digest = createHash('sha256').update(content).digest('hex');
  if (!groups.has(digest)) groups.set(digest, { text: content, references: [] });
  groups.get(digest).references.push({ label, source });
}

// npm marks dependencies that are also reachable from runtime roots as non-dev.
// This deliberately includes runtime type packages and unused/tree-shaken
// helpers; it is a conservative inventory, not a claim they all ship in JS.
const runtime = Object.entries(lock.packages)
  .filter(([location, entry]) => location && entry.dev !== true)
  .sort(([a], [b]) => compare(a, b));

for (const [location, entry] of runtime) {
  if (!location.startsWith('node_modules/') || location.includes('..')) {
    throw new Error(`Unexpected runtime dependency location: ${location}`);
  }
  const directory = path.join(root, location);
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  if (manifest.version !== entry.version) {
    throw new Error(`Installed version differs from lockfile: ${location}. Run npm ci.`);
  }
  const label = `${manifest.name}@${manifest.version}`;
  const license = manifest.license || entry.license || 'Identifier omitted by package; see license text';
  inventory.push(`${label}\n  License: ${typeof license === 'string' ? license : JSON.stringify(license)}\n  Installed at: ${location}`);
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((file) => file.isFile() && /^(licen[cs]e|copying|notice|copyright)([._-]|$)/i.test(file.name))
    .map((file) => file.name).sort(compare);
  const hasLicense = files.some((file) => /^(licen[cs]e|copying)([._-]|$)/i.test(file));
  for (const file of files) {
    addText(label, `${location}/${file}`, await readFile(path.join(directory, file), 'utf8'));
  }
  if (!hasLicense) {
    const supplement = supplements[label];
    if (!supplement) throw new Error(`Missing license text for ${label}; review upstream before release.`);
    for (const document of supplement.documents) addText(label, document.source, document.text);
    if (supplement.note) limitations.push(`${label}: ${supplement.note}`);
  }
}

// Fiber vendors React's reconciler rather than declaring it as a runtime npm
// dependency. Its installed source carries Meta's MIT header; preserve the
// corresponding complete React license even if the runtime tree changes.
const reconcilerHeader = await readFile(path.join(root, 'node_modules/@react-three/fiber/react-reconciler/index.js'), 'utf8');
if (!reconcilerHeader.includes('Copyright (c) Meta Platforms, Inc. and affiliates.')) {
  throw new Error('Fiber reconciler copyright changed; review its bundled license.');
}
addText('React reconciler bundled by @react-three/fiber',
  'node_modules/react/LICENSE (matches the installed reconciler Meta MIT header)',
  await readFile(path.join(root, 'node_modules/react/LICENSE'), 'utf8'));

// Preserve the actual Apache copyright headers from packages that omit a
// standalone license. No copyright holder or year is inferred from metadata.
for (const [label, file] of [
  ['@mediapipe/tasks-vision@0.10.17', 'node_modules/@mediapipe/tasks-vision/vision.d.ts'],
  ['draco3d@1.5.7', 'node_modules/draco3d/draco_nodejs_example.js'],
]) {
  const content = await readFile(path.join(root, file), 'utf8');
  const headers = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
  const lineHeader = content.match(/^(?:\/\/[^\n]*\n|\s*\n)+/);
  if (lineHeader) headers.push(lineHeader[0]);
  const notices = [...new Set(headers.filter((header) => /Copyright/.test(header) && /Apache License/.test(header)))];
  if (!notices.length) throw new Error(`Missing expected Apache copyright header: ${file}`);
  for (const notice of notices) addText(label, file, notice);
}

// Preserve the BSD notice in the EXR loader's published original source map;
// compilation removed it from three-stdlib's JavaScript, but not the package.
const exrMapPath = 'node_modules/three-stdlib/loaders/EXRLoader.js.map';
const exrMap = JSON.parse(await readFile(path.join(root, exrMapPath), 'utf8'));
const exrHeaders = exrMap.sourcesContent.join('\n').match(/\/\*[\s\S]*?\*\//g) || [];
const exrNotice = exrHeaders.find((header) => header.includes('Copyright (c) 2014 - 2017, Syoyo Fujita'));
if (!exrNotice) throw new Error('EXR loader notice changed; review its third-party copyright.');
addText('TinyEXR-derived code in three-stdlib EXRLoader', exrMapPath, exrNotice);

// These prebundled helpers are not separate lockfile packages. Their installed
// headers explicitly refer to upstream licenses; snapshots preserve those
// notices offline without claiming an unrecorded helper revision.
for (const supplement of bundledSupplements) {
  const installed = await readFile(path.join(root, supplement.installed), 'utf8');
  const header = installed.match(/^\/\*[\s\S]*?\*\//)?.[0];
  if (!header || !header.includes(supplement.marker)) {
    throw new Error(`Bundled helper header changed: ${supplement.installed}`);
  }
  addText(supplement.label, supplement.installed, header);
  addText(supplement.label, supplement.source, supplement.text);
}
addText('WOFF2OTF bundled by troika-three-text',
  'Apache-2.0 canonical terms, as required by the installed helper header',
  supplements['@mediapipe/tasks-vision@0.10.17'].documents[0].text);

const heading = `HANDHELD STUDIO — THIRD-PARTY NOTICES

Generated by scripts/third-party-notices.mjs from installed package licenses and
the committed npm lockfile. Regenerate with npm ci followed by:
  node scripts/third-party-notices.mjs
Verify without writing:
  node scripts/third-party-notices.mjs --check

Scope: ${runtime.length} non-dev lockfile entries, including transitive dependencies.
This is a conservative superset: some helpers/types are not in the browser
bundle. Identical license texts are printed once with every source listed.
License/copyright/NOTICE wording is retained; line-end whitespace is normalized.
This file does not select a license for Handheld Studio's original work.

UPSTREAM PACKAGING NOTES
${limitations.join('\n\n')}

DEPENDENCY INVENTORY
${inventory.join('\n\n')}

LICENSE TEXTS AND COPYRIGHT NOTICES
`;
const sections = [...groups.values()].map(({ text, references }, index) =>
  `\n${'='.repeat(78)}\nNotice ${index + 1}\n${references.map(({ label, source }) => `${label}\n  Source: ${source}`).join('\n')}\n${'-'.repeat(78)}\n${text}`,
);
const output = normalize(heading + sections.join(''));
if (args.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8');
  if (normalize(existing) !== output) {
    throw new Error('Third-party notices are stale. Run node scripts/third-party-notices.mjs and review the diff.');
  }
  console.log(`Third-party notices current: ${runtime.length} packages, ${groups.size} distinct texts, ${Buffer.byteLength(output)} bytes.`);
} else {
  await writeFile(outputPath, output, 'utf8');
  console.log(`Wrote public/third-party-notices.txt: ${runtime.length} packages, ${groups.size} distinct texts, ${Buffer.byteLength(output)} bytes.`);
}
