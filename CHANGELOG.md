## 7.8.0-test.7 (2026-03-13)

🔧 Maintenance

- Fix version bump syntax in release workflow [f3ac61dc]

## 7.8.0-test.6 (2026-03-13)

🔧 Maintenance

- Fix changelog generation in release workflow (04a789ec)

## 7.8.0-test.5 (2026-03-13)

🔧 Maintenance

- Update deployment configuration to use dashes instead of dots in environment naming (baca4d32)

## 7.8.0-test.4 (2026-03-13)

## 📝 Documentation

- Update and streamline skill documentation for captcha, exec, and quickstart features [SDK] (86d90bbf)
- Remove outdated Moby integration references from documentation [SDK] (08fa8e18)

## 7.8.0-test.3 (2026-03-13)

## ✨ Features

- Add comprehensive find() cache permutation integration tests to improve test coverage and reliability [API] (6a957f69)
- Add changelog documentation to SDK package [SDK] (6a957f69)

## 🐛 Bug Fixes

- Fix dashcam URL parsing issues that could cause recording problems [SDK] (6a957f69)

## 🔧 Maintenance

- Update subdomain routing configuration for improved service connectivity [API] (6a957f69)
- Streamline GitHub Actions workflows by consolidating publish processes [CI] (6a957f69)
- Update environment configuration for test, dev, and canary deployments [Infrastructure] (6a957f69)
- Improve development container and VS Code task configurations [Development] (6a957f69)

## 7.8.0-test.2 (2026-03-13)

## ✨ Features

- Implement automatic cleanup of unused Ably channels to improve resource management [API] (df6181de)

## 🔧 Maintenance

- Streamline CI/CD workflows with improved test organization and environment configuration [SDK] (df6181de)
- Enhance development environment setup with better environment variable management (df6181de)
- Improve connection handling and URL resolution for better reliability [SDK] (df6181de)

## 7.6.0-test.8 (2026-03-13)

🔧 Maintenance

- Improve release workflow automation for more reliable package promotions (358bb702)

## 7.6.0-test.7 (2026-03-13)

## 🔧 Maintenance

- Eliminate CI race conditions in promotion pipeline and streamline release workflows [CI] (9d83f886)
- Improve VNC URL display in CI environments [API] (9d83f886)
- Add dynamic channel resolution system for SDK configuration [SDK] (9d83f886)
- Update MCP server dependencies and enhance error handling [SDK] (9d83f886)

## 7.6.0-test.6 (2026-03-13)

## 🔧 Maintenance

- Improve CI/CD pipeline reliability by eliminating race conditions in release promotion workflows [c21f708d]
- Fix VNC URL display in continuous integration environment [API] [c21f708d]

## 7.6.0-test.5 (2026-03-12)

## 🔧 Maintenance

- Update SDK channel configuration [SDK] (274fff79)

## 7.6.0-test.4 (2026-03-12)

## 🔧 Maintenance

- Improve release workflow and deployment configuration [SDK] (eeea7649)
- Add enhanced web analytics tracking for better user insights [SDK] (eeea7649)

## 7.6.0-test.3 (2026-03-12)

## 🔧 Maintenance

- Improve release workflow automation and package promotion process [bb6be95]

## 7.6.0-test.2 (2026-03-12)

## 🔧 Maintenance

- Add automated publishing workflows for stable and canary releases [SDK] (2972b3be)
- Update CI workflows to improve testing efficiency and reliability [SDK] (2972b3be)

## 7.6.0-test.1 (2026-03-12)

🔧 Maintenance

- Improve CI/CD workflow reliability and testing coverage [SDK] (eb86a515)
- Update MCP server implementation for better stability [SDK] (eb86a515)

📝 Documentation

- Add new visual documentation for content parsing functionality [SDK] (eb86a515)

## 7.6.0-test.0 (2026-03-12)

## ✨ Features

- Add stable/canary deployment channels with separate environments for production and development branches [API] (64542a8d)
- Add /version API endpoint returning deployment channel information [API] (64542a8d)
- Implement user limits and team member invitation controls [API] (6381290a)
- Add comprehensive GitHub Copilot skills and agent documentation for AI-assisted test development [SDK] (5ff15796)
- Add testimonials section with customer logos and quotes to marketing site [Web] (6381290a)
- Add contact and demo pages to marketing site [Web] (6381290a)
- Improve test environment management with better configuration and deployment workflows [Runner] (5c96e056)

## 🐛 Bug Fixes

- Fix environment configuration and Tailscale connectivity issues [Runner] (5c96e056)
- Resolve Redis URL configuration problems across environments [API] (eca334be)
- Fix Vite API endpoint configuration for proper environment targeting [Web] (bf7fdf54)

## 🔧 Maintenance

- Update pricing configuration and plans structure [API] (6381290a)
- Improve deployment workflows with promotion pipelines between test, canary, and stable branches [CI/CD] (1994d769)
- Add toast notification system for better user feedback [Web] (multiple commits)
- Rename TestAnalytics to TestMetrics for clarity [Web] (multiple commits)
- Remove outdated marketing articles and legal pages [Web] (6381290a)
- Update terms of service with new date [Web] (6381290a)

## 7.5.25 (2026-03-09)

## 🐛 Bug Fixes

- Fix runner restart functionality to ensure proper VM recovery after interruptions [Runner] (47173fa5)

## 7.5.24 (2026-03-09)

## ✨ Features

- Disable automatic runner version updates [API] (f59d8209)

## 7.5.23 (2026-03-09)

📝 **Documentation**

- Add comprehensive marketing content including 1,100+ testing articles, blog posts, changelog entries, and tool documentation [Marketing] (07a801b6)
- Add legal documentation including privacy policy and terms of service [Marketing] (07a801b6)
- Add migration script for importing content from external sources [Marketing] (07a801b6)

🔧 **Maintenance**

- Update AMI build configuration for runner infrastructure [Runner] (07a801b6)
- Update Vite configuration for marketing site build process [Marketing] (07a801b6)
- Minor footer and hero component updates [Marketing] (07a801b6)

## 7.5.22 (2026-03-09)

## ✨ Features

- Add markdown-to-HTML rendering for articles, blog posts, legal pages, and changelog on the marketing website [Web] (1d7f2248)

## 7.5.21 (2026-03-09)

✨ **Features**
- Redesigned homepage with improved navigation and user experience [Web] (8d150c36)
- Added comprehensive examples showcase to help users get started [Web] (8d150c36)

🐛 **Bug Fixes**
- Fixed Stripe checkout pricing issues [Web] (8d150c36)
- Resolved witness functionality issues [Web] (8d150c36)

## 7.5.20 (2026-03-09)

## 🔧 Maintenance

- Update instance autoscaling parameters for improved resource management [Runner] (c5345356)

## 7.5.19 (2026-03-09)

## ✨ Features

- Enhanced element location debugging capabilities with improved cache hit tracking [API]
- Added comprehensive debugging support across multiple components for better troubleshooting [Web, API, Runner] (5564017d)

## 🔧 Maintenance

- Improved element location performance and reliability through optimized caching mechanisms [API] (5564017d)
- Streamlined automation workflow execution for better efficiency [Runner] (5564017d)
- Updated CI/CD workflows for enhanced release and testing processes [GitHub Actions] (5564017d)

## 7.5.18 (2026-03-09)

## 🔧 Maintenance

- Optimize monitoring performance by reducing transaction sampling rate [Image Worker] (adb2a35d)

## 7.5.17 (2026-03-07)

## ✨ Features
- Enhanced marketing website with new "How It Works" section and improved visual components (161c1c7b)
- Added new brand assets and workflow illustrations for better user onboarding (161c1c7b)

## 🐛 Bug Fixes
- Fixed Stripe checkout pricing and authentication issues [API] (161c1c7b)
- Resolved potential witness functionality issues [SDK] (161c1c7b)

## 🔧 Maintenance
- Updated SDK documentation examples with improved formatting and generation scripts [SDK] (161c1c7b)
- Enhanced sandbox authentication and SDK functionality [SDK] (161c1c7b)
- Improved development environment configuration and tooling (161c1c7b)

## 7.5.16 (2026-03-07)

## ✨ Features

- Updated pricing structure and checkout flow for improved billing experience [API] (7821df39)

## 🐛 Bug Fixes

- Fixed Stripe integration issues affecting payment processing [API] (7821df39)

## 7.5.15 (2026-03-07)

## 🐛 Bug Fixes

- Fix Stripe checkout session creation and update pricing display components [API] (57ece2a5)

## 7.5.14 (2026-03-06)

## 🔧 Maintenance

- Update brand assets and marketing materials with new logos, icons, and product screenshots (dbaf002e)
- Update API endpoint configuration for Stripe payment processing [API] (dbaf002e)
- Update default project initialization settings [SDK] (dbaf002e)

## 7.5.13 (2026-03-06)

## ✨ Features

- Add new marketing website with comprehensive landing pages, pricing, features, and documentation sections [Marketing] (a1d567fe)

## 🔧 Maintenance

- Update API server location configuration across all components [API] (a1d567fe)
- Upgrade runner AMI and improve deployment automation [Runner] (a1d567fe)
- Add automated testing for runner auto-upgrade functionality [Runner] (a1d567fe)
- Update Windows CI workflow configuration [CI] (a1d567fe)

## 7.5.12 (2026-03-06)

## 🔧 Maintenance

- Update infrastructure configuration and improve CI/CD pipeline reliability [API, SDK] (42f8bd3c)

## 7.5.11 (2026-03-06)

## 🔧 Maintenance

- Consolidate GitHub workflows by removing nested workflow files and centralizing VS Code build and test processes (79701b5f)
- Remove extensive GitHub Copilot skills documentation from SDK package to streamline repository structure (ea19cf96)
- Update development container configuration with improved VS Code extensions (3c8ebe5e)
- Update package publishing configuration to use latest tag (8ba8136d)

## 7.5.10 (2026-03-06)

## 🔧 Maintenance

- Streamline repository structure by consolidating GitHub workflows and removing duplicate configuration files (ea19cf96)

## 7.5.9 (2026-03-06)

## 🔧 Maintenance

- Improve logging and error handling across runner and API services [Runner, API] (543ee70a)
- Update SDK publishing workflow to use beta tag for pre-release versions [SDK] (543ee70a)
- Enhance sandbox agent reliability and self-update mechanisms [Runner] (543ee70a)

## 7.5.8 (2026-03-06)

## 🔧 Maintenance

- Remove deprecated SDK publishing workflow and update runner configuration [Runner] (84ec0219)

## 7.5.7 (2026-03-06)

## ✨ Features

- Improve Windows compatibility by renaming skill directories to use hyphens instead of colons [SDK] (7f00a912)
- Add automated release workflow for streamlined version management across packages (227a9f00)
- Enhance development environment with improved devcontainer setup and service management scripts (d5bf8460)

## 🐛 Bug Fixes

- Fix usage limit checking functionality to properly validate account limits [API] (360ce1e9)
- Resolve cloning issues on Windows systems caused by invalid directory names in skill files [SDK] (a0cbb8db)

## 🔧 Maintenance

- Streamline debugger interface with simplified HTML structure [SDK] (d5bf8460)
- Remove deprecated Vitest gate server and global setup files [SDK] (d5bf8460)
- Clean up unused debugger assets from web package [Web] (d5bf8460)
- Update environment configuration and service authentication [API] (19cf8b34)
- Consolidate GitHub workflows and remove duplicate test configurations [API] (d5bf8460)
- Add version synchronization and changelog generation scripts for better release management (d5bf8460)

## 7.5.6 (2026-03-05)


### Bug Fixes

* Ably direct connection provisioning + reconnect resilience ([39e778a](https://github.com/testdriverai/mono/commit/39e778ac73cc51caad076149cf1671b37973ccf6))
* Ably reconnect resilience - faster retry + suspended state handler ([c228202](https://github.com/testdriverai/mono/commit/c228202a6593b9431d0cc2d3514b0722bf526e8a))
* direction & amount not correctly sent to VM ([488a0d0](https://github.com/testdriverai/mono/commit/488a0d0921428e7673dddcf27b3238af8d88a7b1))
* Mouse scrolling in VM ([#291](https://github.com/testdriverai/mono/issues/291)) ([80ca55e](https://github.com/testdriverai/mono/commit/80ca55ec91ce00052bea81ce3033aad7c5216e47))
* OpenCV throws if needle is larger than the haystack ([#292](https://github.com/testdriverai/mono/issues/292)) ([652b8b1](https://github.com/testdriverai/mono/commit/652b8b109d1c45ee4becbfb923d33a15a1e0d443))
* provision Ably credentials via SSM for direct IP connections ([6ecdecf](https://github.com/testdriverai/mono/commit/6ecdecf766897a506cd20a3a03814eae48a168f8))
* reduce Sentry noise from PyAutoGUIClient unhandled data logs ([#122](https://github.com/testdriverai/mono/issues/122)) ([93b6d74](https://github.com/testdriverai/mono/commit/93b6d7485c1f6accc36d9efee10ea8b819c02d72))
* skip connectToSandboxDirect for E2B sandboxes (url already available from create) ([2a58865](https://github.com/testdriverai/mono/commit/2a58865ebc04b0299f7b92ed912aa78cfc2c8736))
* use team ID in E2B screenshot S3 path to match download-url access check ([0d1b6ee](https://github.com/testdriverai/mono/commit/0d1b6ee702008b31677c8f4e0858ee3f2acbbbaf))


### Features

* Add elementSimilarity to selector cache ([#121](https://github.com/testdriverai/mono/issues/121)) ([ce39b2e](https://github.com/testdriverai/mono/commit/ce39b2e819e22d72f401e5762e45cef3478752d9))
* add type and confidence inputs to find endpoint ([#162](https://github.com/testdriverai/mono/issues/162)) ([283e699](https://github.com/testdriverai/mono/commit/283e699523ce362cf1e73086dbb99281336a5a23)), closes [#164](https://github.com/testdriverai/mono/issues/164)
* add type option to find(), move confidence to API, rename ocr to parse ([#640](https://github.com/testdriverai/mono/issues/640)) ([d98a94b](https://github.com/testdriverai/mono/commit/d98a94bd05c135c74d9fed2ebb72c709fc643337))
* add windows key ([59b96e8](https://github.com/testdriverai/mono/commit/59b96e8db4d2a29539d9dadc19431c70abe81e3e))
* **auth:** create team and start Stripe trial on new user signup ([1dcd2b4](https://github.com/testdriverai/mono/commit/1dcd2b408335515b09efdc8415248242c802393b))
* stream exec stdout in 16KB chunks to avoid Ably 64KB limit ([018f7b5](https://github.com/testdriverai/mono/commit/018f7b5380107818aa415714ee48a3656ebc2d76))
* Websocket connection health and request timeouts ([#109](https://github.com/testdriverai/mono/issues/109)) ([b7709f5](https://github.com/testdriverai/mono/commit/b7709f5dfaf3b051684f8728708cbc518754cb93))


### Reverts

* Revert "Fix hanging node processes on Ctrl+C (#654)" (#683) ([5e68748](https://github.com/testdriverai/mono/commit/5e6874825c6718e006bbf84e2ba5edae57d173ac)), closes [#654](https://github.com/testdriverai/mono/issues/654) [#683](https://github.com/testdriverai/mono/issues/683)
* Revert "Ianjennings/fly (#72)" ([09e2417](https://github.com/testdriverai/mono/commit/09e241731537ff094e7096afc1b2e5d804353226)), closes [#72](https://github.com/testdriverai/mono/issues/72)
* Revert "list dashcam version g" ([5037571](https://github.com/testdriverai/mono/commit/5037571440c33f8966104874c542c6c57a809510))
* Revert "Disable warm instances by setting pool size to 0 (#49)" (#51) ([c442ec5](https://github.com/testdriverai/mono/commit/c442ec52edab586be3ae8a3eadb34c32338cdea3)), closes [#49](https://github.com/testdriverai/mono/issues/49) [#51](https://github.com/testdriverai/mono/issues/51)
* Revert "update discord invite" ([b5a9b99](https://github.com/testdriverai/mono/commit/b5a9b9955cf2b0b07fd0ebeb6abf65f89cd3d5a8))
* Revert "Change MAX_INSTANCES from 50 to 8 (#40)" (#41) ([1d4a3ca](https://github.com/testdriverai/mono/commit/1d4a3cacc5624b478f1e09b953cd56680e160292)), closes [#40](https://github.com/testdriverai/mono/issues/40) [#41](https://github.com/testdriverai/mono/issues/41)
* Revert "TDT-68 – Show User API Key on Team page" (#349) ([3a594aa](https://github.com/testdriverai/mono/commit/3a594aa73ef36f6b50585c72b9a770708a21c932)), closes [#349](https://github.com/testdriverai/mono/issues/349) [#348](https://github.com/testdriverai/mono/issues/348)
* Revert "TDT-129 – Always run postrun, even on failure (#368)" (#411) ([1be8c7c](https://github.com/testdriverai/mono/commit/1be8c7c1d22cff39d4a96261c31d8befb8376f47)), closes [#368](https://github.com/testdriverai/mono/issues/368) [#411](https://github.com/testdriverai/mono/issues/411)
* Revert "TDT-139 – Add hover-text-with-single-characters test" (#407) ([203529a](https://github.com/testdriverai/mono/commit/203529a434e21eb0ccc8037c6ce88f53a4a62f81)), closes [#407](https://github.com/testdriverai/mono/issues/407) [#381](https://github.com/testdriverai/mono/issues/381)
* Revert "Fix json-schema (#387)" (#389) ([4bddbba](https://github.com/testdriverai/mono/commit/4bddbbad49cd0e491f47e86fb5ecbf945f162bdc)), closes [#387](https://github.com/testdriverai/mono/issues/387) [#389](https://github.com/testdriverai/mono/issues/389)
* Revert "build with new version of testdriverai client" ([70bdb70](https://github.com/testdriverai/mono/commit/70bdb7033e99f8457205a126261dde295ec1b1f3))
* Revert "TDT-68-user-apiKey" (#347) ([ecc6057](https://github.com/testdriverai/mono/commit/ecc6057f719d92f8dc7a32e156fdc812f04a0d3b)), closes [#347](https://github.com/testdriverai/mono/issues/347) [#346](https://github.com/testdriverai/mono/issues/346)
* Revert "TD-2151 – throw if an env variable is missing (#285)" (#288) ([2fcbdf1](https://github.com/testdriverai/mono/commit/2fcbdf1f190b9ced7644f872fd02e64339dbe956)), closes [#285](https://github.com/testdriverai/mono/issues/285) [#288](https://github.com/testdriverai/mono/issues/288)
* Revert "Match Images Server Side (#268)" ([1a49198](https://github.com/testdriverai/mono/commit/1a49198b34293d8da8972b32d02bac94c1f1519b)), closes [#268](https://github.com/testdriverai/mono/issues/268)
* Revert "optimal fix for typing repeated chars (#235)" (#254) ([da773b3](https://github.com/testdriverai/mono/commit/da773b34055ccccf38993c23c4a8a86ccc5ccf74)), closes [#235](https://github.com/testdriverai/mono/issues/235) [#254](https://github.com/testdriverai/mono/issues/254)
* Revert "make sure things get summarized" ([38be3a3](https://github.com/testdriverai/mono/commit/38be3a3da13147760fc4e84b82bb5672343e9493))
* Revert "reverting to 137" ([07d9d48](https://github.com/testdriverai/mono/commit/07d9d48e2820119eacee6daafcf7dda89182f6d5))
* Revert "Add Api key support (#127)" ([f0dccb7](https://github.com/testdriverai/mono/commit/f0dccb72bb2ed35a4634f83f0e71b58bfe8516f5)), closes [#127](https://github.com/testdriverai/mono/issues/127)
* Revert "chrome extension survey page (#269)" ([6fe67d1](https://github.com/testdriverai/mono/commit/6fe67d18fa2e238f173c96f5f24af0d7d277ed0c)), closes [#269](https://github.com/testdriverai/mono/issues/269)
* Revert "Update "Always by your side" description" ([26893a9](https://github.com/testdriverai/mono/commit/26893a90008a099d51ff6955642e54eb917cf464))
* Revert "add correct reporting for env in vite" ([3fb0c8f](https://github.com/testdriverai/mono/commit/3fb0c8ff309beffa5f6a99cec645a2693f12030a))
## 7.5.5 (2026-03-05)


### Bug Fixes

* Ably direct connection provisioning + reconnect resilience ([39e778a](https://github.com/testdriverai/mono/commit/39e778ac73cc51caad076149cf1671b37973ccf6))
* Ably reconnect resilience - faster retry + suspended state handler ([c228202](https://github.com/testdriverai/mono/commit/c228202a6593b9431d0cc2d3514b0722bf526e8a))
* direction & amount not correctly sent to VM ([488a0d0](https://github.com/testdriverai/mono/commit/488a0d0921428e7673dddcf27b3238af8d88a7b1))
* Mouse scrolling in VM ([#291](https://github.com/testdriverai/mono/issues/291)) ([80ca55e](https://github.com/testdriverai/mono/commit/80ca55ec91ce00052bea81ce3033aad7c5216e47))
* OpenCV throws if needle is larger than the haystack ([#292](https://github.com/testdriverai/mono/issues/292)) ([652b8b1](https://github.com/testdriverai/mono/commit/652b8b109d1c45ee4becbfb923d33a15a1e0d443))
* provision Ably credentials via SSM for direct IP connections ([6ecdecf](https://github.com/testdriverai/mono/commit/6ecdecf766897a506cd20a3a03814eae48a168f8))
* reduce Sentry noise from PyAutoGUIClient unhandled data logs ([#122](https://github.com/testdriverai/mono/issues/122)) ([93b6d74](https://github.com/testdriverai/mono/commit/93b6d7485c1f6accc36d9efee10ea8b819c02d72))
* skip connectToSandboxDirect for E2B sandboxes (url already available from create) ([2a58865](https://github.com/testdriverai/mono/commit/2a58865ebc04b0299f7b92ed912aa78cfc2c8736))
* use team ID in E2B screenshot S3 path to match download-url access check ([0d1b6ee](https://github.com/testdriverai/mono/commit/0d1b6ee702008b31677c8f4e0858ee3f2acbbbaf))


### Features

* Add elementSimilarity to selector cache ([#121](https://github.com/testdriverai/mono/issues/121)) ([ce39b2e](https://github.com/testdriverai/mono/commit/ce39b2e819e22d72f401e5762e45cef3478752d9))
* add type and confidence inputs to find endpoint ([#162](https://github.com/testdriverai/mono/issues/162)) ([283e699](https://github.com/testdriverai/mono/commit/283e699523ce362cf1e73086dbb99281336a5a23)), closes [#164](https://github.com/testdriverai/mono/issues/164)
* add type option to find(), move confidence to API, rename ocr to parse ([#640](https://github.com/testdriverai/mono/issues/640)) ([d98a94b](https://github.com/testdriverai/mono/commit/d98a94bd05c135c74d9fed2ebb72c709fc643337))
* add windows key ([59b96e8](https://github.com/testdriverai/mono/commit/59b96e8db4d2a29539d9dadc19431c70abe81e3e))
* **auth:** create team and start Stripe trial on new user signup ([1dcd2b4](https://github.com/testdriverai/mono/commit/1dcd2b408335515b09efdc8415248242c802393b))
* stream exec stdout in 16KB chunks to avoid Ably 64KB limit ([018f7b5](https://github.com/testdriverai/mono/commit/018f7b5380107818aa415714ee48a3656ebc2d76))
* Websocket connection health and request timeouts ([#109](https://github.com/testdriverai/mono/issues/109)) ([b7709f5](https://github.com/testdriverai/mono/commit/b7709f5dfaf3b051684f8728708cbc518754cb93))


### Reverts

* Revert "Fix hanging node processes on Ctrl+C (#654)" (#683) ([5e68748](https://github.com/testdriverai/mono/commit/5e6874825c6718e006bbf84e2ba5edae57d173ac)), closes [#654](https://github.com/testdriverai/mono/issues/654) [#683](https://github.com/testdriverai/mono/issues/683)
* Revert "Ianjennings/fly (#72)" ([09e2417](https://github.com/testdriverai/mono/commit/09e241731537ff094e7096afc1b2e5d804353226)), closes [#72](https://github.com/testdriverai/mono/issues/72)
* Revert "list dashcam version g" ([5037571](https://github.com/testdriverai/mono/commit/5037571440c33f8966104874c542c6c57a809510))
* Revert "Disable warm instances by setting pool size to 0 (#49)" (#51) ([c442ec5](https://github.com/testdriverai/mono/commit/c442ec52edab586be3ae8a3eadb34c32338cdea3)), closes [#49](https://github.com/testdriverai/mono/issues/49) [#51](https://github.com/testdriverai/mono/issues/51)
* Revert "update discord invite" ([b5a9b99](https://github.com/testdriverai/mono/commit/b5a9b9955cf2b0b07fd0ebeb6abf65f89cd3d5a8))
* Revert "Change MAX_INSTANCES from 50 to 8 (#40)" (#41) ([1d4a3ca](https://github.com/testdriverai/mono/commit/1d4a3cacc5624b478f1e09b953cd56680e160292)), closes [#40](https://github.com/testdriverai/mono/issues/40) [#41](https://github.com/testdriverai/mono/issues/41)
* Revert "TDT-68 – Show User API Key on Team page" (#349) ([3a594aa](https://github.com/testdriverai/mono/commit/3a594aa73ef36f6b50585c72b9a770708a21c932)), closes [#349](https://github.com/testdriverai/mono/issues/349) [#348](https://github.com/testdriverai/mono/issues/348)
* Revert "TDT-129 – Always run postrun, even on failure (#368)" (#411) ([1be8c7c](https://github.com/testdriverai/mono/commit/1be8c7c1d22cff39d4a96261c31d8befb8376f47)), closes [#368](https://github.com/testdriverai/mono/issues/368) [#411](https://github.com/testdriverai/mono/issues/411)
* Revert "TDT-139 – Add hover-text-with-single-characters test" (#407) ([203529a](https://github.com/testdriverai/mono/commit/203529a434e21eb0ccc8037c6ce88f53a4a62f81)), closes [#407](https://github.com/testdriverai/mono/issues/407) [#381](https://github.com/testdriverai/mono/issues/381)
* Revert "Fix json-schema (#387)" (#389) ([4bddbba](https://github.com/testdriverai/mono/commit/4bddbbad49cd0e491f47e86fb5ecbf945f162bdc)), closes [#387](https://github.com/testdriverai/mono/issues/387) [#389](https://github.com/testdriverai/mono/issues/389)
* Revert "build with new version of testdriverai client" ([70bdb70](https://github.com/testdriverai/mono/commit/70bdb7033e99f8457205a126261dde295ec1b1f3))
* Revert "TDT-68-user-apiKey" (#347) ([ecc6057](https://github.com/testdriverai/mono/commit/ecc6057f719d92f8dc7a32e156fdc812f04a0d3b)), closes [#347](https://github.com/testdriverai/mono/issues/347) [#346](https://github.com/testdriverai/mono/issues/346)
* Revert "TD-2151 – throw if an env variable is missing (#285)" (#288) ([2fcbdf1](https://github.com/testdriverai/mono/commit/2fcbdf1f190b9ced7644f872fd02e64339dbe956)), closes [#285](https://github.com/testdriverai/mono/issues/285) [#288](https://github.com/testdriverai/mono/issues/288)
* Revert "Match Images Server Side (#268)" ([1a49198](https://github.com/testdriverai/mono/commit/1a49198b34293d8da8972b32d02bac94c1f1519b)), closes [#268](https://github.com/testdriverai/mono/issues/268)
* Revert "optimal fix for typing repeated chars (#235)" (#254) ([da773b3](https://github.com/testdriverai/mono/commit/da773b34055ccccf38993c23c4a8a86ccc5ccf74)), closes [#235](https://github.com/testdriverai/mono/issues/235) [#254](https://github.com/testdriverai/mono/issues/254)
* Revert "make sure things get summarized" ([38be3a3](https://github.com/testdriverai/mono/commit/38be3a3da13147760fc4e84b82bb5672343e9493))
* Revert "reverting to 137" ([07d9d48](https://github.com/testdriverai/mono/commit/07d9d48e2820119eacee6daafcf7dda89182f6d5))
* Revert "Add Api key support (#127)" ([f0dccb7](https://github.com/testdriverai/mono/commit/f0dccb72bb2ed35a4634f83f0e71b58bfe8516f5)), closes [#127](https://github.com/testdriverai/mono/issues/127)
* Revert "chrome extension survey page (#269)" ([6fe67d1](https://github.com/testdriverai/mono/commit/6fe67d18fa2e238f173c96f5f24af0d7d277ed0c)), closes [#269](https://github.com/testdriverai/mono/issues/269)
* Revert "Update "Always by your side" description" ([26893a9](https://github.com/testdriverai/mono/commit/26893a90008a099d51ff6955642e54eb917cf464))
* Revert "add correct reporting for env in vite" ([3fb0c8f](https://github.com/testdriverai/mono/commit/3fb0c8ff309beffa5f6a99cec645a2693f12030a))
## 7.5.4 (2026-03-05)


### Bug Fixes

* Ably direct connection provisioning + reconnect resilience ([39e778a](https://github.com/testdriverai/mono/commit/39e778ac73cc51caad076149cf1671b37973ccf6))
* Ably reconnect resilience - faster retry + suspended state handler ([c228202](https://github.com/testdriverai/mono/commit/c228202a6593b9431d0cc2d3514b0722bf526e8a))
* direction & amount not correctly sent to VM ([488a0d0](https://github.com/testdriverai/mono/commit/488a0d0921428e7673dddcf27b3238af8d88a7b1))
* Mouse scrolling in VM ([#291](https://github.com/testdriverai/mono/issues/291)) ([80ca55e](https://github.com/testdriverai/mono/commit/80ca55ec91ce00052bea81ce3033aad7c5216e47))
* OpenCV throws if needle is larger than the haystack ([#292](https://github.com/testdriverai/mono/issues/292)) ([652b8b1](https://github.com/testdriverai/mono/commit/652b8b109d1c45ee4becbfb923d33a15a1e0d443))
* provision Ably credentials via SSM for direct IP connections ([6ecdecf](https://github.com/testdriverai/mono/commit/6ecdecf766897a506cd20a3a03814eae48a168f8))
* reduce Sentry noise from PyAutoGUIClient unhandled data logs ([#122](https://github.com/testdriverai/mono/issues/122)) ([93b6d74](https://github.com/testdriverai/mono/commit/93b6d7485c1f6accc36d9efee10ea8b819c02d72))
* skip connectToSandboxDirect for E2B sandboxes (url already available from create) ([2a58865](https://github.com/testdriverai/mono/commit/2a58865ebc04b0299f7b92ed912aa78cfc2c8736))
* use team ID in E2B screenshot S3 path to match download-url access check ([0d1b6ee](https://github.com/testdriverai/mono/commit/0d1b6ee702008b31677c8f4e0858ee3f2acbbbaf))


### Features

* Add elementSimilarity to selector cache ([#121](https://github.com/testdriverai/mono/issues/121)) ([ce39b2e](https://github.com/testdriverai/mono/commit/ce39b2e819e22d72f401e5762e45cef3478752d9))
* add type and confidence inputs to find endpoint ([#162](https://github.com/testdriverai/mono/issues/162)) ([283e699](https://github.com/testdriverai/mono/commit/283e699523ce362cf1e73086dbb99281336a5a23)), closes [#164](https://github.com/testdriverai/mono/issues/164)
* add type option to find(), move confidence to API, rename ocr to parse ([#640](https://github.com/testdriverai/mono/issues/640)) ([d98a94b](https://github.com/testdriverai/mono/commit/d98a94bd05c135c74d9fed2ebb72c709fc643337))
* add windows key ([59b96e8](https://github.com/testdriverai/mono/commit/59b96e8db4d2a29539d9dadc19431c70abe81e3e))
* **auth:** create team and start Stripe trial on new user signup ([1dcd2b4](https://github.com/testdriverai/mono/commit/1dcd2b408335515b09efdc8415248242c802393b))
* stream exec stdout in 16KB chunks to avoid Ably 64KB limit ([018f7b5](https://github.com/testdriverai/mono/commit/018f7b5380107818aa415714ee48a3656ebc2d76))
* Websocket connection health and request timeouts ([#109](https://github.com/testdriverai/mono/issues/109)) ([b7709f5](https://github.com/testdriverai/mono/commit/b7709f5dfaf3b051684f8728708cbc518754cb93))


### Reverts

* Revert "Fix hanging node processes on Ctrl+C (#654)" (#683) ([5e68748](https://github.com/testdriverai/mono/commit/5e6874825c6718e006bbf84e2ba5edae57d173ac)), closes [#654](https://github.com/testdriverai/mono/issues/654) [#683](https://github.com/testdriverai/mono/issues/683)
* Revert "Ianjennings/fly (#72)" ([09e2417](https://github.com/testdriverai/mono/commit/09e241731537ff094e7096afc1b2e5d804353226)), closes [#72](https://github.com/testdriverai/mono/issues/72)
* Revert "list dashcam version g" ([5037571](https://github.com/testdriverai/mono/commit/5037571440c33f8966104874c542c6c57a809510))
* Revert "Disable warm instances by setting pool size to 0 (#49)" (#51) ([c442ec5](https://github.com/testdriverai/mono/commit/c442ec52edab586be3ae8a3eadb34c32338cdea3)), closes [#49](https://github.com/testdriverai/mono/issues/49) [#51](https://github.com/testdriverai/mono/issues/51)
* Revert "update discord invite" ([b5a9b99](https://github.com/testdriverai/mono/commit/b5a9b9955cf2b0b07fd0ebeb6abf65f89cd3d5a8))
* Revert "Change MAX_INSTANCES from 50 to 8 (#40)" (#41) ([1d4a3ca](https://github.com/testdriverai/mono/commit/1d4a3cacc5624b478f1e09b953cd56680e160292)), closes [#40](https://github.com/testdriverai/mono/issues/40) [#41](https://github.com/testdriverai/mono/issues/41)
* Revert "TDT-68 – Show User API Key on Team page" (#349) ([3a594aa](https://github.com/testdriverai/mono/commit/3a594aa73ef36f6b50585c72b9a770708a21c932)), closes [#349](https://github.com/testdriverai/mono/issues/349) [#348](https://github.com/testdriverai/mono/issues/348)
* Revert "TDT-129 – Always run postrun, even on failure (#368)" (#411) ([1be8c7c](https://github.com/testdriverai/mono/commit/1be8c7c1d22cff39d4a96261c31d8befb8376f47)), closes [#368](https://github.com/testdriverai/mono/issues/368) [#411](https://github.com/testdriverai/mono/issues/411)
* Revert "TDT-139 – Add hover-text-with-single-characters test" (#407) ([203529a](https://github.com/testdriverai/mono/commit/203529a434e21eb0ccc8037c6ce88f53a4a62f81)), closes [#407](https://github.com/testdriverai/mono/issues/407) [#381](https://github.com/testdriverai/mono/issues/381)
* Revert "Fix json-schema (#387)" (#389) ([4bddbba](https://github.com/testdriverai/mono/commit/4bddbbad49cd0e491f47e86fb5ecbf945f162bdc)), closes [#387](https://github.com/testdriverai/mono/issues/387) [#389](https://github.com/testdriverai/mono/issues/389)
* Revert "build with new version of testdriverai client" ([70bdb70](https://github.com/testdriverai/mono/commit/70bdb7033e99f8457205a126261dde295ec1b1f3))
* Revert "TDT-68-user-apiKey" (#347) ([ecc6057](https://github.com/testdriverai/mono/commit/ecc6057f719d92f8dc7a32e156fdc812f04a0d3b)), closes [#347](https://github.com/testdriverai/mono/issues/347) [#346](https://github.com/testdriverai/mono/issues/346)
* Revert "TD-2151 – throw if an env variable is missing (#285)" (#288) ([2fcbdf1](https://github.com/testdriverai/mono/commit/2fcbdf1f190b9ced7644f872fd02e64339dbe956)), closes [#285](https://github.com/testdriverai/mono/issues/285) [#288](https://github.com/testdriverai/mono/issues/288)
* Revert "Match Images Server Side (#268)" ([1a49198](https://github.com/testdriverai/mono/commit/1a49198b34293d8da8972b32d02bac94c1f1519b)), closes [#268](https://github.com/testdriverai/mono/issues/268)
* Revert "optimal fix for typing repeated chars (#235)" (#254) ([da773b3](https://github.com/testdriverai/mono/commit/da773b34055ccccf38993c23c4a8a86ccc5ccf74)), closes [#235](https://github.com/testdriverai/mono/issues/235) [#254](https://github.com/testdriverai/mono/issues/254)
* Revert "make sure things get summarized" ([38be3a3](https://github.com/testdriverai/mono/commit/38be3a3da13147760fc4e84b82bb5672343e9493))
* Revert "reverting to 137" ([07d9d48](https://github.com/testdriverai/mono/commit/07d9d48e2820119eacee6daafcf7dda89182f6d5))
* Revert "Add Api key support (#127)" ([f0dccb7](https://github.com/testdriverai/mono/commit/f0dccb72bb2ed35a4634f83f0e71b58bfe8516f5)), closes [#127](https://github.com/testdriverai/mono/issues/127)
* Revert "chrome extension survey page (#269)" ([6fe67d1](https://github.com/testdriverai/mono/commit/6fe67d18fa2e238f173c96f5f24af0d7d277ed0c)), closes [#269](https://github.com/testdriverai/mono/issues/269)
* Revert "Update "Always by your side" description" ([26893a9](https://github.com/testdriverai/mono/commit/26893a90008a099d51ff6955642e54eb917cf464))
* Revert "add correct reporting for env in vite" ([3fb0c8f](https://github.com/testdriverai/mono/commit/3fb0c8ff309beffa5f6a99cec645a2693f12030a))
## 7.5.3 (2026-03-05)


### Bug Fixes

* Ably direct connection provisioning + reconnect resilience ([39e778a](https://github.com/testdriverai/mono/commit/39e778ac73cc51caad076149cf1671b37973ccf6))
* Ably reconnect resilience - faster retry + suspended state handler ([c228202](https://github.com/testdriverai/mono/commit/c228202a6593b9431d0cc2d3514b0722bf526e8a))
* direction & amount not correctly sent to VM ([488a0d0](https://github.com/testdriverai/mono/commit/488a0d0921428e7673dddcf27b3238af8d88a7b1))
* Mouse scrolling in VM ([#291](https://github.com/testdriverai/mono/issues/291)) ([80ca55e](https://github.com/testdriverai/mono/commit/80ca55ec91ce00052bea81ce3033aad7c5216e47))
* OpenCV throws if needle is larger than the haystack ([#292](https://github.com/testdriverai/mono/issues/292)) ([652b8b1](https://github.com/testdriverai/mono/commit/652b8b109d1c45ee4becbfb923d33a15a1e0d443))
* provision Ably credentials via SSM for direct IP connections ([6ecdecf](https://github.com/testdriverai/mono/commit/6ecdecf766897a506cd20a3a03814eae48a168f8))
* reduce Sentry noise from PyAutoGUIClient unhandled data logs ([#122](https://github.com/testdriverai/mono/issues/122)) ([93b6d74](https://github.com/testdriverai/mono/commit/93b6d7485c1f6accc36d9efee10ea8b819c02d72))
* skip connectToSandboxDirect for E2B sandboxes (url already available from create) ([2a58865](https://github.com/testdriverai/mono/commit/2a58865ebc04b0299f7b92ed912aa78cfc2c8736))
* use team ID in E2B screenshot S3 path to match download-url access check ([0d1b6ee](https://github.com/testdriverai/mono/commit/0d1b6ee702008b31677c8f4e0858ee3f2acbbbaf))


### Features

* Add elementSimilarity to selector cache ([#121](https://github.com/testdriverai/mono/issues/121)) ([ce39b2e](https://github.com/testdriverai/mono/commit/ce39b2e819e22d72f401e5762e45cef3478752d9))
* add type and confidence inputs to find endpoint ([#162](https://github.com/testdriverai/mono/issues/162)) ([283e699](https://github.com/testdriverai/mono/commit/283e699523ce362cf1e73086dbb99281336a5a23)), closes [#164](https://github.com/testdriverai/mono/issues/164)
* add type option to find(), move confidence to API, rename ocr to parse ([#640](https://github.com/testdriverai/mono/issues/640)) ([d98a94b](https://github.com/testdriverai/mono/commit/d98a94bd05c135c74d9fed2ebb72c709fc643337))
* add windows key ([59b96e8](https://github.com/testdriverai/mono/commit/59b96e8db4d2a29539d9dadc19431c70abe81e3e))
* **auth:** create team and start Stripe trial on new user signup ([1dcd2b4](https://github.com/testdriverai/mono/commit/1dcd2b408335515b09efdc8415248242c802393b))
* stream exec stdout in 16KB chunks to avoid Ably 64KB limit ([018f7b5](https://github.com/testdriverai/mono/commit/018f7b5380107818aa415714ee48a3656ebc2d76))
* Websocket connection health and request timeouts ([#109](https://github.com/testdriverai/mono/issues/109)) ([b7709f5](https://github.com/testdriverai/mono/commit/b7709f5dfaf3b051684f8728708cbc518754cb93))


### Reverts

* Revert "Fix hanging node processes on Ctrl+C (#654)" (#683) ([5e68748](https://github.com/testdriverai/mono/commit/5e6874825c6718e006bbf84e2ba5edae57d173ac)), closes [#654](https://github.com/testdriverai/mono/issues/654) [#683](https://github.com/testdriverai/mono/issues/683)
* Revert "Ianjennings/fly (#72)" ([09e2417](https://github.com/testdriverai/mono/commit/09e241731537ff094e7096afc1b2e5d804353226)), closes [#72](https://github.com/testdriverai/mono/issues/72)
* Revert "list dashcam version g" ([5037571](https://github.com/testdriverai/mono/commit/5037571440c33f8966104874c542c6c57a809510))
* Revert "Disable warm instances by setting pool size to 0 (#49)" (#51) ([c442ec5](https://github.com/testdriverai/mono/commit/c442ec52edab586be3ae8a3eadb34c32338cdea3)), closes [#49](https://github.com/testdriverai/mono/issues/49) [#51](https://github.com/testdriverai/mono/issues/51)
* Revert "update discord invite" ([b5a9b99](https://github.com/testdriverai/mono/commit/b5a9b9955cf2b0b07fd0ebeb6abf65f89cd3d5a8))
* Revert "Change MAX_INSTANCES from 50 to 8 (#40)" (#41) ([1d4a3ca](https://github.com/testdriverai/mono/commit/1d4a3cacc5624b478f1e09b953cd56680e160292)), closes [#40](https://github.com/testdriverai/mono/issues/40) [#41](https://github.com/testdriverai/mono/issues/41)
* Revert "TDT-68 – Show User API Key on Team page" (#349) ([3a594aa](https://github.com/testdriverai/mono/commit/3a594aa73ef36f6b50585c72b9a770708a21c932)), closes [#349](https://github.com/testdriverai/mono/issues/349) [#348](https://github.com/testdriverai/mono/issues/348)
* Revert "TDT-129 – Always run postrun, even on failure (#368)" (#411) ([1be8c7c](https://github.com/testdriverai/mono/commit/1be8c7c1d22cff39d4a96261c31d8befb8376f47)), closes [#368](https://github.com/testdriverai/mono/issues/368) [#411](https://github.com/testdriverai/mono/issues/411)
* Revert "TDT-139 – Add hover-text-with-single-characters test" (#407) ([203529a](https://github.com/testdriverai/mono/commit/203529a434e21eb0ccc8037c6ce88f53a4a62f81)), closes [#407](https://github.com/testdriverai/mono/issues/407) [#381](https://github.com/testdriverai/mono/issues/381)
* Revert "Fix json-schema (#387)" (#389) ([4bddbba](https://github.com/testdriverai/mono/commit/4bddbbad49cd0e491f47e86fb5ecbf945f162bdc)), closes [#387](https://github.com/testdriverai/mono/issues/387) [#389](https://github.com/testdriverai/mono/issues/389)
* Revert "build with new version of testdriverai client" ([70bdb70](https://github.com/testdriverai/mono/commit/70bdb7033e99f8457205a126261dde295ec1b1f3))
* Revert "TDT-68-user-apiKey" (#347) ([ecc6057](https://github.com/testdriverai/mono/commit/ecc6057f719d92f8dc7a32e156fdc812f04a0d3b)), closes [#347](https://github.com/testdriverai/mono/issues/347) [#346](https://github.com/testdriverai/mono/issues/346)
* Revert "TD-2151 – throw if an env variable is missing (#285)" (#288) ([2fcbdf1](https://github.com/testdriverai/mono/commit/2fcbdf1f190b9ced7644f872fd02e64339dbe956)), closes [#285](https://github.com/testdriverai/mono/issues/285) [#288](https://github.com/testdriverai/mono/issues/288)
* Revert "Match Images Server Side (#268)" ([1a49198](https://github.com/testdriverai/mono/commit/1a49198b34293d8da8972b32d02bac94c1f1519b)), closes [#268](https://github.com/testdriverai/mono/issues/268)
* Revert "optimal fix for typing repeated chars (#235)" (#254) ([da773b3](https://github.com/testdriverai/mono/commit/da773b34055ccccf38993c23c4a8a86ccc5ccf74)), closes [#235](https://github.com/testdriverai/mono/issues/235) [#254](https://github.com/testdriverai/mono/issues/254)
* Revert "make sure things get summarized" ([38be3a3](https://github.com/testdriverai/mono/commit/38be3a3da13147760fc4e84b82bb5672343e9493))
* Revert "reverting to 137" ([07d9d48](https://github.com/testdriverai/mono/commit/07d9d48e2820119eacee6daafcf7dda89182f6d5))
* Revert "Add Api key support (#127)" ([f0dccb7](https://github.com/testdriverai/mono/commit/f0dccb72bb2ed35a4634f83f0e71b58bfe8516f5)), closes [#127](https://github.com/testdriverai/mono/issues/127)
* Revert "chrome extension survey page (#269)" ([6fe67d1](https://github.com/testdriverai/mono/commit/6fe67d18fa2e238f173c96f5f24af0d7d277ed0c)), closes [#269](https://github.com/testdriverai/mono/issues/269)
* Revert "Update "Always by your side" description" ([26893a9](https://github.com/testdriverai/mono/commit/26893a90008a099d51ff6955642e54eb917cf464))
* Revert "add correct reporting for env in vite" ([3fb0c8f](https://github.com/testdriverai/mono/commit/3fb0c8ff309beffa5f6a99cec645a2693f12030a))
## 7.5.2 (2026-03-04)


### Bug Fixes

* Ably direct connection provisioning + reconnect resilience ([39e778a](https://github.com/testdriverai/mono/commit/39e778ac73cc51caad076149cf1671b37973ccf6))
* Ably reconnect resilience - faster retry + suspended state handler ([c228202](https://github.com/testdriverai/mono/commit/c228202a6593b9431d0cc2d3514b0722bf526e8a))
* direction & amount not correctly sent to VM ([488a0d0](https://github.com/testdriverai/mono/commit/488a0d0921428e7673dddcf27b3238af8d88a7b1))
* Mouse scrolling in VM ([#291](https://github.com/testdriverai/mono/issues/291)) ([80ca55e](https://github.com/testdriverai/mono/commit/80ca55ec91ce00052bea81ce3033aad7c5216e47))
* OpenCV throws if needle is larger than the haystack ([#292](https://github.com/testdriverai/mono/issues/292)) ([652b8b1](https://github.com/testdriverai/mono/commit/652b8b109d1c45ee4becbfb923d33a15a1e0d443))
* provision Ably credentials via SSM for direct IP connections ([6ecdecf](https://github.com/testdriverai/mono/commit/6ecdecf766897a506cd20a3a03814eae48a168f8))
* reduce Sentry noise from PyAutoGUIClient unhandled data logs ([#122](https://github.com/testdriverai/mono/issues/122)) ([93b6d74](https://github.com/testdriverai/mono/commit/93b6d7485c1f6accc36d9efee10ea8b819c02d72))
* skip connectToSandboxDirect for E2B sandboxes (url already available from create) ([2a58865](https://github.com/testdriverai/mono/commit/2a58865ebc04b0299f7b92ed912aa78cfc2c8736))
* use team ID in E2B screenshot S3 path to match download-url access check ([0d1b6ee](https://github.com/testdriverai/mono/commit/0d1b6ee702008b31677c8f4e0858ee3f2acbbbaf))


### Features

* Add elementSimilarity to selector cache ([#121](https://github.com/testdriverai/mono/issues/121)) ([ce39b2e](https://github.com/testdriverai/mono/commit/ce39b2e819e22d72f401e5762e45cef3478752d9))
* add type and confidence inputs to find endpoint ([#162](https://github.com/testdriverai/mono/issues/162)) ([283e699](https://github.com/testdriverai/mono/commit/283e699523ce362cf1e73086dbb99281336a5a23)), closes [#164](https://github.com/testdriverai/mono/issues/164)
* add type option to find(), move confidence to API, rename ocr to parse ([#640](https://github.com/testdriverai/mono/issues/640)) ([d98a94b](https://github.com/testdriverai/mono/commit/d98a94bd05c135c74d9fed2ebb72c709fc643337))
* add windows key ([59b96e8](https://github.com/testdriverai/mono/commit/59b96e8db4d2a29539d9dadc19431c70abe81e3e))
* **auth:** create team and start Stripe trial on new user signup ([1dcd2b4](https://github.com/testdriverai/mono/commit/1dcd2b408335515b09efdc8415248242c802393b))
* stream exec stdout in 16KB chunks to avoid Ably 64KB limit ([018f7b5](https://github.com/testdriverai/mono/commit/018f7b5380107818aa415714ee48a3656ebc2d76))
* Websocket connection health and request timeouts ([#109](https://github.com/testdriverai/mono/issues/109)) ([b7709f5](https://github.com/testdriverai/mono/commit/b7709f5dfaf3b051684f8728708cbc518754cb93))


### Reverts

* Revert "Fix hanging node processes on Ctrl+C (#654)" (#683) ([5e68748](https://github.com/testdriverai/mono/commit/5e6874825c6718e006bbf84e2ba5edae57d173ac)), closes [#654](https://github.com/testdriverai/mono/issues/654) [#683](https://github.com/testdriverai/mono/issues/683)
* Revert "Ianjennings/fly (#72)" ([09e2417](https://github.com/testdriverai/mono/commit/09e241731537ff094e7096afc1b2e5d804353226)), closes [#72](https://github.com/testdriverai/mono/issues/72)
* Revert "list dashcam version g" ([5037571](https://github.com/testdriverai/mono/commit/5037571440c33f8966104874c542c6c57a809510))
* Revert "Disable warm instances by setting pool size to 0 (#49)" (#51) ([c442ec5](https://github.com/testdriverai/mono/commit/c442ec52edab586be3ae8a3eadb34c32338cdea3)), closes [#49](https://github.com/testdriverai/mono/issues/49) [#51](https://github.com/testdriverai/mono/issues/51)
* Revert "update discord invite" ([b5a9b99](https://github.com/testdriverai/mono/commit/b5a9b9955cf2b0b07fd0ebeb6abf65f89cd3d5a8))
* Revert "Change MAX_INSTANCES from 50 to 8 (#40)" (#41) ([1d4a3ca](https://github.com/testdriverai/mono/commit/1d4a3cacc5624b478f1e09b953cd56680e160292)), closes [#40](https://github.com/testdriverai/mono/issues/40) [#41](https://github.com/testdriverai/mono/issues/41)
* Revert "TDT-68 – Show User API Key on Team page" (#349) ([3a594aa](https://github.com/testdriverai/mono/commit/3a594aa73ef36f6b50585c72b9a770708a21c932)), closes [#349](https://github.com/testdriverai/mono/issues/349) [#348](https://github.com/testdriverai/mono/issues/348)
* Revert "TDT-129 – Always run postrun, even on failure (#368)" (#411) ([1be8c7c](https://github.com/testdriverai/mono/commit/1be8c7c1d22cff39d4a96261c31d8befb8376f47)), closes [#368](https://github.com/testdriverai/mono/issues/368) [#411](https://github.com/testdriverai/mono/issues/411)
* Revert "TDT-139 – Add hover-text-with-single-characters test" (#407) ([203529a](https://github.com/testdriverai/mono/commit/203529a434e21eb0ccc8037c6ce88f53a4a62f81)), closes [#407](https://github.com/testdriverai/mono/issues/407) [#381](https://github.com/testdriverai/mono/issues/381)
* Revert "Fix json-schema (#387)" (#389) ([4bddbba](https://github.com/testdriverai/mono/commit/4bddbbad49cd0e491f47e86fb5ecbf945f162bdc)), closes [#387](https://github.com/testdriverai/mono/issues/387) [#389](https://github.com/testdriverai/mono/issues/389)
* Revert "build with new version of testdriverai client" ([70bdb70](https://github.com/testdriverai/mono/commit/70bdb7033e99f8457205a126261dde295ec1b1f3))
* Revert "TDT-68-user-apiKey" (#347) ([ecc6057](https://github.com/testdriverai/mono/commit/ecc6057f719d92f8dc7a32e156fdc812f04a0d3b)), closes [#347](https://github.com/testdriverai/mono/issues/347) [#346](https://github.com/testdriverai/mono/issues/346)
* Revert "TD-2151 – throw if an env variable is missing (#285)" (#288) ([2fcbdf1](https://github.com/testdriverai/mono/commit/2fcbdf1f190b9ced7644f872fd02e64339dbe956)), closes [#285](https://github.com/testdriverai/mono/issues/285) [#288](https://github.com/testdriverai/mono/issues/288)
* Revert "Match Images Server Side (#268)" ([1a49198](https://github.com/testdriverai/mono/commit/1a49198b34293d8da8972b32d02bac94c1f1519b)), closes [#268](https://github.com/testdriverai/mono/issues/268)
* Revert "optimal fix for typing repeated chars (#235)" (#254) ([da773b3](https://github.com/testdriverai/mono/commit/da773b34055ccccf38993c23c4a8a86ccc5ccf74)), closes [#235](https://github.com/testdriverai/mono/issues/235) [#254](https://github.com/testdriverai/mono/issues/254)
* Revert "make sure things get summarized" ([38be3a3](https://github.com/testdriverai/mono/commit/38be3a3da13147760fc4e84b82bb5672343e9493))
* Revert "reverting to 137" ([07d9d48](https://github.com/testdriverai/mono/commit/07d9d48e2820119eacee6daafcf7dda89182f6d5))
* Revert "Add Api key support (#127)" ([f0dccb7](https://github.com/testdriverai/mono/commit/f0dccb72bb2ed35a4634f83f0e71b58bfe8516f5)), closes [#127](https://github.com/testdriverai/mono/issues/127)
* Revert "chrome extension survey page (#269)" ([6fe67d1](https://github.com/testdriverai/mono/commit/6fe67d18fa2e238f173c96f5f24af0d7d277ed0c)), closes [#269](https://github.com/testdriverai/mono/issues/269)
* Revert "Update "Always by your side" description" ([26893a9](https://github.com/testdriverai/mono/commit/26893a90008a099d51ff6955642e54eb917cf464))
* Revert "add correct reporting for env in vite" ([3fb0c8f](https://github.com/testdriverai/mono/commit/3fb0c8ff309beffa5f6a99cec645a2693f12030a))
## 7.5.1 (2026-03-04)


### Bug Fixes

* Ably direct connection provisioning + reconnect resilience ([39e778a](https://github.com/testdriverai/mono/commit/39e778ac73cc51caad076149cf1671b37973ccf6))
* Ably reconnect resilience - faster retry + suspended state handler ([c228202](https://github.com/testdriverai/mono/commit/c228202a6593b9431d0cc2d3514b0722bf526e8a))
* direction & amount not correctly sent to VM ([488a0d0](https://github.com/testdriverai/mono/commit/488a0d0921428e7673dddcf27b3238af8d88a7b1))
* Mouse scrolling in VM ([#291](https://github.com/testdriverai/mono/issues/291)) ([80ca55e](https://github.com/testdriverai/mono/commit/80ca55ec91ce00052bea81ce3033aad7c5216e47))
* OpenCV throws if needle is larger than the haystack ([#292](https://github.com/testdriverai/mono/issues/292)) ([652b8b1](https://github.com/testdriverai/mono/commit/652b8b109d1c45ee4becbfb923d33a15a1e0d443))
* provision Ably credentials via SSM for direct IP connections ([6ecdecf](https://github.com/testdriverai/mono/commit/6ecdecf766897a506cd20a3a03814eae48a168f8))
* reduce Sentry noise from PyAutoGUIClient unhandled data logs ([#122](https://github.com/testdriverai/mono/issues/122)) ([93b6d74](https://github.com/testdriverai/mono/commit/93b6d7485c1f6accc36d9efee10ea8b819c02d72))
* skip connectToSandboxDirect for E2B sandboxes (url already available from create) ([2a58865](https://github.com/testdriverai/mono/commit/2a58865ebc04b0299f7b92ed912aa78cfc2c8736))
* use team ID in E2B screenshot S3 path to match download-url access check ([0d1b6ee](https://github.com/testdriverai/mono/commit/0d1b6ee702008b31677c8f4e0858ee3f2acbbbaf))


### Features

* Add elementSimilarity to selector cache ([#121](https://github.com/testdriverai/mono/issues/121)) ([ce39b2e](https://github.com/testdriverai/mono/commit/ce39b2e819e22d72f401e5762e45cef3478752d9))
* add type and confidence inputs to find endpoint ([#162](https://github.com/testdriverai/mono/issues/162)) ([283e699](https://github.com/testdriverai/mono/commit/283e699523ce362cf1e73086dbb99281336a5a23)), closes [#164](https://github.com/testdriverai/mono/issues/164)
* add type option to find(), move confidence to API, rename ocr to parse ([#640](https://github.com/testdriverai/mono/issues/640)) ([d98a94b](https://github.com/testdriverai/mono/commit/d98a94bd05c135c74d9fed2ebb72c709fc643337))
* add windows key ([59b96e8](https://github.com/testdriverai/mono/commit/59b96e8db4d2a29539d9dadc19431c70abe81e3e))
* **auth:** create team and start Stripe trial on new user signup ([1dcd2b4](https://github.com/testdriverai/mono/commit/1dcd2b408335515b09efdc8415248242c802393b))
* stream exec stdout in 16KB chunks to avoid Ably 64KB limit ([018f7b5](https://github.com/testdriverai/mono/commit/018f7b5380107818aa415714ee48a3656ebc2d76))
* Websocket connection health and request timeouts ([#109](https://github.com/testdriverai/mono/issues/109)) ([b7709f5](https://github.com/testdriverai/mono/commit/b7709f5dfaf3b051684f8728708cbc518754cb93))


### Reverts

* Revert "Fix hanging node processes on Ctrl+C (#654)" (#683) ([5e68748](https://github.com/testdriverai/mono/commit/5e6874825c6718e006bbf84e2ba5edae57d173ac)), closes [#654](https://github.com/testdriverai/mono/issues/654) [#683](https://github.com/testdriverai/mono/issues/683)
* Revert "Ianjennings/fly (#72)" ([09e2417](https://github.com/testdriverai/mono/commit/09e241731537ff094e7096afc1b2e5d804353226)), closes [#72](https://github.com/testdriverai/mono/issues/72)
* Revert "list dashcam version g" ([5037571](https://github.com/testdriverai/mono/commit/5037571440c33f8966104874c542c6c57a809510))
* Revert "Disable warm instances by setting pool size to 0 (#49)" (#51) ([c442ec5](https://github.com/testdriverai/mono/commit/c442ec52edab586be3ae8a3eadb34c32338cdea3)), closes [#49](https://github.com/testdriverai/mono/issues/49) [#51](https://github.com/testdriverai/mono/issues/51)
* Revert "update discord invite" ([b5a9b99](https://github.com/testdriverai/mono/commit/b5a9b9955cf2b0b07fd0ebeb6abf65f89cd3d5a8))
* Revert "Change MAX_INSTANCES from 50 to 8 (#40)" (#41) ([1d4a3ca](https://github.com/testdriverai/mono/commit/1d4a3cacc5624b478f1e09b953cd56680e160292)), closes [#40](https://github.com/testdriverai/mono/issues/40) [#41](https://github.com/testdriverai/mono/issues/41)
* Revert "TDT-68 – Show User API Key on Team page" (#349) ([3a594aa](https://github.com/testdriverai/mono/commit/3a594aa73ef36f6b50585c72b9a770708a21c932)), closes [#349](https://github.com/testdriverai/mono/issues/349) [#348](https://github.com/testdriverai/mono/issues/348)
* Revert "TDT-129 – Always run postrun, even on failure (#368)" (#411) ([1be8c7c](https://github.com/testdriverai/mono/commit/1be8c7c1d22cff39d4a96261c31d8befb8376f47)), closes [#368](https://github.com/testdriverai/mono/issues/368) [#411](https://github.com/testdriverai/mono/issues/411)
* Revert "TDT-139 – Add hover-text-with-single-characters test" (#407) ([203529a](https://github.com/testdriverai/mono/commit/203529a434e21eb0ccc8037c6ce88f53a4a62f81)), closes [#407](https://github.com/testdriverai/mono/issues/407) [#381](https://github.com/testdriverai/mono/issues/381)
* Revert "Fix json-schema (#387)" (#389) ([4bddbba](https://github.com/testdriverai/mono/commit/4bddbbad49cd0e491f47e86fb5ecbf945f162bdc)), closes [#387](https://github.com/testdriverai/mono/issues/387) [#389](https://github.com/testdriverai/mono/issues/389)
* Revert "build with new version of testdriverai client" ([70bdb70](https://github.com/testdriverai/mono/commit/70bdb7033e99f8457205a126261dde295ec1b1f3))
* Revert "TDT-68-user-apiKey" (#347) ([ecc6057](https://github.com/testdriverai/mono/commit/ecc6057f719d92f8dc7a32e156fdc812f04a0d3b)), closes [#347](https://github.com/testdriverai/mono/issues/347) [#346](https://github.com/testdriverai/mono/issues/346)
* Revert "TD-2151 – throw if an env variable is missing (#285)" (#288) ([2fcbdf1](https://github.com/testdriverai/mono/commit/2fcbdf1f190b9ced7644f872fd02e64339dbe956)), closes [#285](https://github.com/testdriverai/mono/issues/285) [#288](https://github.com/testdriverai/mono/issues/288)
* Revert "Match Images Server Side (#268)" ([1a49198](https://github.com/testdriverai/mono/commit/1a49198b34293d8da8972b32d02bac94c1f1519b)), closes [#268](https://github.com/testdriverai/mono/issues/268)
* Revert "optimal fix for typing repeated chars (#235)" (#254) ([da773b3](https://github.com/testdriverai/mono/commit/da773b34055ccccf38993c23c4a8a86ccc5ccf74)), closes [#235](https://github.com/testdriverai/mono/issues/235) [#254](https://github.com/testdriverai/mono/issues/254)
* Revert "make sure things get summarized" ([38be3a3](https://github.com/testdriverai/mono/commit/38be3a3da13147760fc4e84b82bb5672343e9493))
* Revert "reverting to 137" ([07d9d48](https://github.com/testdriverai/mono/commit/07d9d48e2820119eacee6daafcf7dda89182f6d5))
* Revert "Add Api key support (#127)" ([f0dccb7](https://github.com/testdriverai/mono/commit/f0dccb72bb2ed35a4634f83f0e71b58bfe8516f5)), closes [#127](https://github.com/testdriverai/mono/issues/127)
* Revert "chrome extension survey page (#269)" ([6fe67d1](https://github.com/testdriverai/mono/commit/6fe67d18fa2e238f173c96f5f24af0d7d277ed0c)), closes [#269](https://github.com/testdriverai/mono/issues/269)
* Revert "Update "Always by your side" description" ([26893a9](https://github.com/testdriverai/mono/commit/26893a90008a099d51ff6955642e54eb917cf464))
* Revert "add correct reporting for env in vite" ([3fb0c8f](https://github.com/testdriverai/mono/commit/3fb0c8ff309beffa5f6a99cec645a2693f12030a))
## [7.4.5](https://github.com/testdriverai/testdriverai/compare/v7.3.43...v7.4.5) (2026-02-27)



## [7.3.44](https://github.com/testdriverai/testdriverai/compare/v7.3.43...v7.3.44) (2026-02-26)



## [7.3.43](https://github.com/testdriverai/testdriverai/compare/v7.3.42...v7.3.43) (2026-02-25)



## [7.3.42](https://github.com/testdriverai/testdriverai/compare/v7.3.41...v7.3.42) (2026-02-25)



## [7.3.41](https://github.com/testdriverai/testdriverai/compare/v7.3.40...v7.3.41) (2026-02-25)



## [7.3.40](https://github.com/testdriverai/testdriverai/compare/v7.3.39...v7.3.40) (2026-02-25)



## [7.3.39](https://github.com/testdriverai/testdriverai/compare/v7.3.38...v7.3.39) (2026-02-25)



## [7.3.38](https://github.com/testdriverai/testdriverai/compare/v7.3.37...v7.3.38) (2026-02-25)



## [7.3.37](https://github.com/testdriverai/testdriverai/compare/v7.3.36...v7.3.37) (2026-02-24)



## [7.3.36](https://github.com/testdriverai/testdriverai/compare/v7.3.35...v7.3.36) (2026-02-24)


### Reverts

* Revert "Fix hanging node processes on Ctrl+C (#654)" (#683) ([5e68748](https://github.com/testdriverai/testdriverai/commit/5e6874825c6718e006bbf84e2ba5edae57d173ac)), closes [#654](https://github.com/testdriverai/testdriverai/issues/654) [#683](https://github.com/testdriverai/testdriverai/issues/683)



## [7.3.35](https://github.com/testdriverai/testdriverai/compare/v7.3.34...v7.3.35) (2026-02-24)



## [7.3.34](https://github.com/testdriverai/testdriverai/compare/v7.3.33...v7.3.34) (2026-02-24)



## [7.3.33](https://github.com/testdriverai/testdriverai/compare/v7.3.32...v7.3.33) (2026-02-24)



## [7.3.32](https://github.com/testdriverai/testdriverai/compare/v7.3.31...v7.3.32) (2026-02-20)



## [7.3.31](https://github.com/testdriverai/testdriverai/compare/v7.3.30...v7.3.31) (2026-02-20)



## [7.3.30](https://github.com/testdriverai/testdriverai/compare/v7.3.29...v7.3.30) (2026-02-20)



## [7.3.29](https://github.com/testdriverai/testdriverai/compare/v7.3.28...v7.3.29) (2026-02-20)



## [7.3.28](https://github.com/testdriverai/testdriverai/compare/v7.3.27...v7.3.28) (2026-02-20)



## [7.3.27](https://github.com/testdriverai/testdriverai/compare/v7.3.25...v7.3.27) (2026-02-20)



## [7.3.26](https://github.com/testdriverai/testdriverai/compare/v7.3.25...v7.3.26) (2026-02-20)



## [7.3.25](https://github.com/testdriverai/testdriverai/compare/v7.3.24...v7.3.25) (2026-02-20)



## [7.3.24](https://github.com/testdriverai/testdriverai/compare/v7.3.23...v7.3.24) (2026-02-20)



## [7.3.23](https://github.com/testdriverai/testdriverai/compare/v7.3.22...v7.3.23) (2026-02-20)



## [7.3.22](https://github.com/testdriverai/testdriverai/compare/v7.3.21...v7.3.22) (2026-02-19)



## [7.3.21](https://github.com/testdriverai/testdriverai/compare/v7.3.20...v7.3.21) (2026-02-19)



## [7.3.20](https://github.com/testdriverai/testdriverai/compare/v7.3.19...v7.3.20) (2026-02-19)



## [7.3.19](https://github.com/testdriverai/testdriverai/compare/v7.3.17...v7.3.19) (2026-02-19)



## [7.3.18](https://github.com/testdriverai/testdriverai/compare/v7.3.17...v7.3.18) (2026-02-19)



## [7.3.17](https://github.com/testdriverai/testdriverai/compare/v7.3.16...v7.3.17) (2026-02-18)


### Features

* add type option to find(), move confidence to API, rename ocr to parse ([#640](https://github.com/testdriverai/testdriverai/issues/640)) ([d98a94b](https://github.com/testdriverai/testdriverai/commit/d98a94bd05c135c74d9fed2ebb72c709fc643337))



## [7.3.16](https://github.com/testdriverai/testdriverai/compare/v7.3.14...v7.3.16) (2026-02-18)



## [7.3.15](https://github.com/testdriverai/testdriverai/compare/v7.3.14...v7.3.15) (2026-02-18)



## [7.3.14](https://github.com/testdriverai/testdriverai/compare/v7.3.13...v7.3.14) (2026-02-17)



## [7.3.13](https://github.com/testdriverai/testdriverai/compare/v7.3.12...v7.3.13) (2026-02-17)



## [7.3.12](https://github.com/testdriverai/testdriverai/compare/v7.3.11...v7.3.12) (2026-02-17)



## [7.3.11](https://github.com/testdriverai/testdriverai/compare/v7.3.10...v7.3.11) (2026-02-17)



## [7.3.10](https://github.com/testdriverai/testdriverai/compare/v7.3.9...v7.3.10) (2026-02-16)



## [7.3.9](https://github.com/testdriverai/testdriverai/compare/v7.3.8...v7.3.9) (2026-02-12)



## [7.3.8](https://github.com/testdriverai/testdriverai/compare/v7.3.7...v7.3.8) (2026-02-12)



## [7.3.7](https://github.com/testdriverai/testdriverai/compare/v7.3.6...v7.3.7) (2026-02-11)



## [7.3.6](https://github.com/testdriverai/testdriverai/compare/v7.3.5...v7.3.6) (2026-02-10)



## [7.3.5](https://github.com/testdriverai/testdriverai/compare/v7.3.4...v7.3.5) (2026-02-07)



## [7.3.4](https://github.com/testdriverai/testdriverai/compare/v7.3.2...v7.3.4) (2026-02-06)



## [7.3.3](https://github.com/testdriverai/testdriverai/compare/v7.3.2...v7.3.3) (2026-02-06)



## [7.3.2](https://github.com/testdriverai/testdriverai/compare/v7.3.1...v7.3.2) (2026-02-05)



## [7.3.1](https://github.com/testdriverai/testdriverai/compare/v7.2.92...v7.3.1) (2026-02-05)



## [7.2.92](https://github.com/testdriverai/testdriverai/compare/v7.2.91...v7.2.92) (2026-02-04)



## [7.2.91](https://github.com/testdriverai/testdriverai/compare/v7.2.90...v7.2.91) (2026-02-04)



## [7.2.90](https://github.com/testdriverai/testdriverai/compare/v7.2.89...v7.2.90) (2026-02-04)



## [7.2.89](https://github.com/testdriverai/testdriverai/compare/v7.2.88...v7.2.89) (2026-02-04)



## [7.2.88](https://github.com/testdriverai/testdriverai/compare/v7.2.87...v7.2.88) (2026-02-04)



## [7.2.87](https://github.com/testdriverai/testdriverai/compare/v7.2.86...v7.2.87) (2026-02-04)



## [7.2.86](https://github.com/testdriverai/testdriverai/compare/v7.2.85...v7.2.86) (2026-02-04)



## [7.2.85](https://github.com/testdriverai/testdriverai/compare/v7.2.84...v7.2.85) (2026-02-04)



## [7.2.84](https://github.com/testdriverai/testdriverai/compare/v7.2.82...v7.2.84) (2026-02-04)



## [7.2.83](https://github.com/testdriverai/testdriverai/compare/v7.2.82...v7.2.83) (2026-02-04)



## [7.2.82](https://github.com/testdriverai/testdriverai/compare/v7.2.81...v7.2.82) (2026-02-04)



## [7.2.81](https://github.com/testdriverai/testdriverai/compare/v7.2.80...v7.2.81) (2026-02-04)



## [7.2.80](https://github.com/testdriverai/testdriverai/compare/v7.2.79...v7.2.80) (2026-02-04)



## [7.2.79](https://github.com/testdriverai/testdriverai/compare/v7.2.78...v7.2.79) (2026-02-03)



## [7.2.78](https://github.com/testdriverai/testdriverai/compare/v7.2.77...v7.2.78) (2026-02-03)



## [7.2.77](https://github.com/testdriverai/testdriverai/compare/v7.2.76...v7.2.77) (2026-02-02)



## [7.2.76](https://github.com/testdriverai/testdriverai/compare/v7.2.75...v7.2.76) (2026-02-02)



## [7.2.75](https://github.com/testdriverai/testdriverai/compare/v7.2.74...v7.2.75) (2026-02-02)



## [7.2.74](https://github.com/testdriverai/testdriverai/compare/v7.2.73...v7.2.74) (2026-02-02)



## [7.2.73](https://github.com/testdriverai/testdriverai/compare/v7.2.72...v7.2.73) (2026-02-02)



## [7.2.72](https://github.com/testdriverai/testdriverai/compare/v7.2.71...v7.2.72) (2026-02-02)



## [7.2.71](https://github.com/testdriverai/testdriverai/compare/v7.2.70...v7.2.71) (2026-02-02)



## [7.2.70](https://github.com/testdriverai/testdriverai/compare/v7.2.69...v7.2.70) (2026-02-02)



## [7.2.69](https://github.com/testdriverai/testdriverai/compare/v7.2.68...v7.2.69) (2026-02-02)



## [7.2.68](https://github.com/testdriverai/testdriverai/compare/v7.2.67...v7.2.68) (2026-02-02)



## [7.2.67](https://github.com/testdriverai/testdriverai/compare/v7.2.66...v7.2.67) (2026-02-02)



## [7.2.66](https://github.com/testdriverai/testdriverai/compare/v7.2.65...v7.2.66) (2026-02-02)



## [7.2.65](https://github.com/testdriverai/testdriverai/compare/v7.2.64...v7.2.65) (2026-02-02)



## [7.2.64](https://github.com/testdriverai/testdriverai/compare/v7.2.63...v7.2.64) (2026-02-02)



## [7.2.63](https://github.com/testdriverai/testdriverai/compare/v7.2.62...v7.2.63) (2026-01-30)



## [7.2.62](https://github.com/testdriverai/testdriverai/compare/v7.2.61...v7.2.62) (2026-01-30)



## [7.2.61](https://github.com/testdriverai/testdriverai/compare/v7.2.60...v7.2.61) (2026-01-30)



## [7.2.60](https://github.com/testdriverai/testdriverai/compare/v7.2.59...v7.2.60) (2026-01-27)



## [7.2.59](https://github.com/testdriverai/testdriverai/compare/v7.2.58...v7.2.59) (2026-01-27)



## [7.2.58](https://github.com/testdriverai/testdriverai/compare/v6.1.8...v7.2.58) (2026-01-27)


### Reverts

* Revert "list dashcam version g" ([5037571](https://github.com/testdriverai/testdriverai/commit/5037571440c33f8966104874c542c6c57a809510))
* Revert "update discord invite" ([b5a9b99](https://github.com/testdriverai/testdriverai/commit/b5a9b9955cf2b0b07fd0ebeb6abf65f89cd3d5a8))



