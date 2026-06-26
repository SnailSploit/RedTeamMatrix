---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 2
---

# SEAMMAP

*The new mind map — a projection of the trust hypergraph, organized by the six seam primitives (not by place/tactic). 288 seams; ⚡ = AGENT-DISCOVERED (new), ◆ = frontier.*

## P1 Data->Control *(45)*

### AI / Agent Attacks
- Adversarial physical patch redirecting embodied-agent action ⚡ _(demonstrated)_
- Agent-issued bulk remote-vehicle command via telematics scope ⚡ _(plausible)_
- DOM/accessibility-tree label injection that diverges from human-visible rendering ⚡ _(plausible)_
- Evaluatee-embedded prompt injection steering an LLM judge's verdict ⚡ _(demonstrated)_
- Instruction smuggling via image/audio/document metadata fields ⚡ _(demonstrated)_
- Membership-inference probing to confirm a record was in the training set ⚡ _(demonstrated)_
- Sensor-stream poisoning shifting AI inference toward harmful actuation ⚡ _(plausible)_
- Suggestion-bias seeding of public corpus to steer completions ⚡ _(plausible)_
- Sybil preference-label injection into reward model ⚡ _(plausible)_
- Ultrasonic/inaudible voice-command injection (DolphinAttack-class) into LLM voice agent ⚡ _(demonstrated)_

### API & Business-Logic Abuse
- Cross-site scripting
- Mass assignment / auto-binding of unexpected fields
- Simulation/execution state divergence yielding decoy preview ⚡ _(demonstrated)_

### Automotive / CAN
- CAN frame spoofing by arbitration ID

### CI/CD & Build Pipeline
- Poisoned Pipeline Execution via controllable CI config/scripts (D-PPE/I-PPE)

### Cloud Attacks
- Event-source data-as-control injection (S3/SQS/SNS/API-Gateway event field into eval/query/exec)

### Credential Access
- Keylogging via input hooks / keyboard API

### Defense Evasion
- Adversarial evasion of ML/LLM detector ◆
- Alert-field to playbook-action injection (host isolation, account disable, firewall rule) via attacker-controlled telemetry ⚡ _(plausible)_
- Prompt-injecting the AI SOC analyst ◆
- SOC-copilot retrieval injection via writable corpus ⚡ _(plausible)_

### Execution
- Command and scripting interpreter abuse (PowerShell, cmd, WMIC, Bash, Python, Perl)
- Insecure deserialization
- Native API execution
- Office macros / VBA / XLM (Excel 4.0) execution
- OS command injection
- Retrieval-time injection (read-side) ◆
- Server-side template injection
- Tool-output / function-return injection ◆

### Identity & Federation Attacks
- Data-broker record seeding to bias an enrichment-API verdict ⚡ _(plausible)_

### Initial Access
- Drive-by compromise / watering-hole browser exploitation
- Edge appliance pre-auth RCE (VPN/Citrix/Ivanti/Edge gateway CVEs)
- Email-borne indirect prompt injection ◆
- Indirect prompt injection via document/file (core LLM red-teaming surface) ◆
- Indirect prompt injection via web/fetch ◆
- Spearphishing / whaling / link / attachment
- SQL injection
- Vishing / pretexting (AI persona)

### Lateral Movement
- Agent-to-agent lateral via persuasion ◆
- Cross-server tool contamination ◆
- Orchestrator-to-worker tasking injection ◆

### Mobile Attacks
- Deep-link / URL-scheme hijack & parameter injection

### Persistence
- Web shell persistence

### Privilege Escalation
- Kernel/OS memory-corruption privilege escalation

### Wireless / RF Attacks
- Coherent capture-and-drag GNSS trajectory injection ⚡ _(demonstrated)_

## P2 Identity->Authority *(81)*

### AI / Agent Attacks
- Agent as confused deputy in cert request/approval (mis-issuance) ⚡ _(plausible)_
- Agent-driven HMI setpoint/command write without operator deliberation ⚡ _(speculative)_
- Agent-driven mass MDM remote wipe / policy push ⚡ _(plausible)_
- Agent-driven rogue device commissioning into Matter/Zigbee fabric ⚡ _(speculative)_
- Agent-orchestrated mass door-unlock / access-control override ⚡ _(speculative)_
- Backdoored guardrail model passing trigger-marked attacks ⚡ _(plausible)_
- Coverage-maximizing query farming for model distillation ⚡ _(demonstrated)_
- Data exfiltration via sandbox egress in model-generated code ⚡ _(demonstrated)_
- Pre-registration of recurrent LLM-hallucinated package names ⚡ _(demonstrated)_
- Rogue self-registered OAuth client via dynamic client registration ⚡ _(plausible)_

### API & Business-Logic Abuse
- Broken Object Level Authorization / IDOR enumeration
- Cross-site request forgery
- Flash-borrowed governance-token snapshot vote capture ⚡ _(demonstrated)_
- Server-side request forgery -> metadata creds

### CI/CD & Build Pipeline
- CI secret and environment exfiltration from build step
- Phishable/typosquatted OIDC identity yielding valid keyless signature ⚡ _(plausible)_

### Cloud Attacks
- AssumeRole external-id confused-deputy (missing/guessable external id, wildcard principal trust policy)
- Cloud instance metadata credential theft
- Illicit consent grant / OAuth phishing
- IMDSv1 token-less credential retrieval (no PUT-token session required)
- Long-lived access-key abuse (leaked AWS keys / GCP SA keys / Azure SP secrets used from attacker host)
- Workload identity federation subject/audience over-scope (wildcard repo/branch/namespace) credential exchange ⚡ _(demonstrated)_

### Collection
- Data from local/email/repository collection & staging
- Database dumps
- File / share staging
- Screenshots / clipboard capture

### Container & Orchestration
- Auto-mounted service-account token theft and replay
- Autonomous in-cluster RBAC abuse by agent ⚡ _(plausible)_
- Unauthenticated kubelet API exec/run on port 10250

### Credential Access
- Audience-unbound agent identity token reuse ⚡ _(plausible)_
- Cloud CLI/browser cached token theft (aws/azure/gcloud/kubeconfig)
- DCShadow rogue replication source (Mimikatz lsadump::dcshadow)
- DCSync replication of credentials (Mimikatz lsadump::dcsync, secretsdump)
- Kerberoasting / AS-REP roasting
- LSASS / OS credential dumping
- NTDS.dit extraction via Volume Shadow Copy / ntdsutil (secretsdump -ntds)

### Cryptography & PKI
- EIP-712 signature replay across shared/forked chainId domain ⚡ _(demonstrated)_

### Discovery
- Account/host/permission discovery
- AD trust-graph enumeration (BloodHound/SharpHound)
- Cloud enumeration (ScoutSuite/Pacu/ROADrecon)
- Internal network scanning (Nmap/masscan host & port discovery)
- Process / service / user discovery
- SMB / share enumeration (CrackMapExec/enum4linux/smbclient)

### Email & Collaboration Abuse
- Illicit OAuth consent-grant application persistence
- Teams/Slack external-guest and tenant-federation phishing

### Hardware / IoT / Firmware
- JTAG/SWD halt-and-dump & memory control

### Identity & Federation Attacks
- Aged synthetic-identity graph defeating cross-source existence checks ⚡ _(demonstrated)_
- Client-asserted device-compliance signal forgery against conditional access ⚡ _(plausible)_
- JIT elevation self-approval / auto-approval path and approver social engineering ⚡ _(plausible)_
- Orphaned service-account / API-key reuse with intact standing entitlements ⚡ _(demonstrated)_
- SAML signature wrapping (XSW) and comment-injection NameID confusion

### Impact
- Autonomous IAM abuse beyond human-tuned baselines ◆
- Crown-jewel data access (PII / IP / financial record staging)
- Domain Admin / Tier-0 takeover (DCSync, golden ticket, full estate control)
- Fraudulent wire transfer / payment fraud path
- Ransomware / data destruction / defacement

### Initial Access
- Badge cloning, lock picking, tailgating
- Exposed RDP/SSH brute-force and credential reuse
- Valid accounts via breach creds, password spray, credential stuffing

### Lateral Movement
- Cloud assume-role chaining and PassRole pivoting
- DCOM lateral execution (MMC20.Application, ShellWindows, Office COM)
- Standing-token reuse across services by agent ◆
- Use alternate auth material / token replay

### Mobile Attacks
- Malicious MDM / configuration-profile enrollment

### OT / ICS Attacks
- SCADA/ICS Modbus/DNP3/S7 unauthenticated coil & register write
- Synchronized DER fleet trip via compromised aggregator ⚡ _(plausible)_

### Privilege Escalation
- AD CS ESC1-ESC16 certificate abuse
- Cloud IAM role chaining and policy privilege escalation
- Human-scoped OAuth grant exercised at machine speed ◆
- Kerberos delegation abuse (RBCD/S4U)
- Linux capability abuse for privilege escalation
- MCP tool-selection confused deputy ◆
- SUID binary and sudo rule abuse (GTFOBins escape)
- Token impersonation/theft via SeImpersonate (Potato family, named-pipe/RPC coercion)

### Reconnaissance
- Active scanning / banner & metadata disclosure (Shodan/Censys/FOFA)
- DNS zone transfer (AXFR via dig/host)
- Google Dorking (advanced search-operator harvesting)
- Physical site survey (badge/ingress/wireless recon)

### Wireless / RF Attacks
- Adversary-in-the-middle / sniffing
- Evil-twin / rogue AP MITM
- Unauthenticated CCSDS telecommand injection on live uplink ⚡ _(plausible)_

## P3 Provenance *(79)*

### AI / Agent Attacks
- Agent-generated over-broad IAM/security-group in IaC ⚡ _(plausible)_
- Agent-narrated firmware verification standing in for real signature check ⚡ _(speculative)_
- Backdoored / alignment-stripping LoRA adapter inheriting base-model trust ⚡ _(plausible)_
- Benchmark test-set contamination inflating procurement score ⚡ _(demonstrated)_
- C2PA manifest removal via re-encode/screenshot/format conversion ⚡ _(demonstrated)_
- Cloned/relayed RF credential ingested by agent as presence proof ⚡ _(plausible)_
- Fabricated or mismatched citation laundering an unsupported claim ⚡ _(demonstrated)_
- Guardrail bypass via distribution gap outside the published eval set ⚡ _(plausible)_
- System-prompt and tool-schema extraction enabling tailored injection ⚡ _(demonstrated)_
- Unsigned agent action lacking authorizer-to-action provenance binding ⚡ _(plausible)_

### API & Business-Logic Abuse
- GNSS/location-spoofed proof of physical work minting rewards ⚡ _(demonstrated)_
- JWT alg=none / RS256-to-HS256 key confusion / kid injection
- Open redirect trust laundering
- Webhook signature bypass / spoof

### Automotive / CAN
- Telematics/infotainment remote compromise (Jeep-class remote pivot)

### CI/CD & Build Pipeline
- Agent-skill typosquat-at-install ⚡ _(plausible)_
- Provenance scope gap (attested build step != exploited step) passing verification ⚡ _(plausible)_
- RAG corpus poisoning (write-side) ◆
- Registry tag mutation / image overwrite (mutable tags)
- Stage capability via trusted distribution

### Cloud Attacks
- Dependency confusion
- Public object-store enumeration and download (S3/GCS/Azure Blob anonymous or all-users ACL)
- Remembered cloud resource-name confusion ⚡ _(plausible)_

### Command and Control
- Application-layer / DNS / domain-fronted C2
- Domain fronting / CDN-fronted C2
- Malleable beacon frameworks (Cobalt Strike / Sliver / Mythic / Havoc / Brute Ratel / Empire)
- Redirectors / malleable profiles / JA3 spoofing
- Web-service C2 via chat platforms (Slack / Discord / Telegram bot APIs)

### Container & Orchestration
- Compromise software supply chain
- Malicious / typosquatted public-registry image pull
- Secrets-in-environment-variable and /proc/environ harvest
- Validating-webhook failure-open / timeout bypass

### Credential Access
- Golden SAML / forged assertion
- Inter-agent trust-token forgery ⚡ _(plausible)_

### Cryptography & PKI
- Certificate mis-issuance and domain-validation abuse
- Exported TLS session keys co-archived with captured ciphertext ⚡ _(speculative)_
- Hash-collision and chosen-prefix forgery (MD5/SHA-1, length-extension)
- Source-chain deep reorg after destination mint at fixed confirmation depth ⚡ _(plausible)_

### Defense Evasion
- Bring Your Own Vulnerable Driver (BYOVD) to tamper kernel/EDR
- Detection-model training poisoning ◆
- Living off the land via signed system binaries (LOLBAS/GTFOBins)
- Poisoned Sigma/detection rule with coverage-preserving exclusion clause via PR to shared repo ⚡ _(plausible)_
- Reflective DLL/PE in-memory loading

### Email & Collaboration Abuse
- SPF/DKIM/DMARC spoofing and header-from alignment abuse

### Execution
- WSUS / update-channel content injection

### Exfiltration
- Exfiltration to trusted cloud storage (Dropbox / Drive / Mega via HTTPS POST)

### Hardware / IoT / Firmware
- Counterfeit COTS subsystem forging intra-bus telemetry ⚡ _(plausible)_
- Unsigned/modified firmware flash

### Identity & Federation Attacks
- Device-code authentication phishing
- Golden SAML forged token-signing key abuse
- Injection-based deepfake liveness bypass via virtual camera / SDK hook ⚡ _(demonstrated)_
- Passkey sync-fabric account takeover to export/replicate the synced credential ⚡ _(plausible)_
- Post-revocation credential acceptance during status-list propagation lag ⚡ _(plausible)_

### Infrastructure / OPSEC
- Aged burner / sock-puppet persona cultivation for platform trust
- Domain aging / expired-domain repurposing for proxy-category trust
- Free-CA cert issuance for benign-appearing C2 hostnames
- Residential / mobile proxy egress for geo and IP-reputation laundering

### Initial Access
- Hardware additions / removable media / evil maid
- Rogue access point / evil twin (Wi-Fi Pineapple)
- USB drop and HID keystroke injection (Rubber Ducky, Bash Bunny, O.MG cable)

### Mobile Attacks
- App repackaging & trojanized sideload
- RSP activation-code/QR hijack installing unauthorized profile ⚡ _(demonstrated)_

### OT / ICS Attacks
- Rogue EWS program/logic download (TIA Portal, Studio 5000 protocol replay)

### Persistence
- Bootkit / kernel rootkit pre-OS persistence
- DLL search-order hijacking and DLL sideloading
- Golden Ticket and Silver Ticket forgery
- Injection-influenced long-term memory write ◆
- MCP capability drift / tool rug-pull across updates ⚡ _(plausible)_
- Memory-pinned supply-chain redirection ⚡ _(plausible)_

### Privilege Escalation
- Weak service binary/permission and writable service config hijack

### Reconnaissance
- GitHub/GitLab leak mining (TruffleHog/Gitleaks/git-dorks)
- OSINT correlation / persona building
- Pastebin / breach-data credential harvesting
- Wayback Machine / archive mining
- WHOIS / DNS-history footprinting

### Wireless / RF Attacks
- Ghost-aircraft ADS-B squitter injection into fusion ⚡ _(demonstrated)_
- RFID/NFC tag cloning (static UID/Mifare)
- SUCI cross-session linkability via unconcealed routing/capability residue ⚡ _(plausible)_
- Unauthenticated AIS phantom-vessel and MMSI-clone injection ⚡ _(demonstrated)_

## P4 Context-Inheritance *(31)*

### AI / Agent Attacks
- Approval-context inheritance across NL-to-fieldbus translation ⚡ _(speculative)_
- Hidden directive embedded in shared agent-definition ⚡ _(plausible)_
- Unsanitized context inheritance across agent spawn boundary ⚡ _(plausible)_

### API & Business-Logic Abuse
- Session fixation
- Validation/execution state divergence draining paymaster deposit ⚡ _(plausible)_

### CI/CD & Build Pipeline
- Self-hosted runner persistence and cross-job contamination

### Cloud Attacks
- Edge isolate module-global secret bleed across requests ⚡ _(speculative)_

### Collection
- Agent-memory cross-tenant bleed ⚡ _(plausible)_
- Shared vector index context carryover ⚡ _(plausible)_

### Command and Control
- Agent memory as dead-drop C2 ◆

### Container & Orchestration
- Authenticated-peer to L7 authz confusion (privileged path/method abuse inside the mesh) ⚡ _(plausible)_
- Container escape to host
- hostPID / hostNetwork process and socket access from pod
- Sidecar/init-container composition authority union ◆

### Credential Access
- AiTM reverse-proxy phishing and session-cookie capture (Evilginx, Modlishka)
- Infostealer browser cookie/credential theft and session import (RedLine, Lumma, Raccoon)

### Defense Evasion
- eBPF-as-rootkit: hook-ordering and map tampering to hide processes/connections from eBPF EDR ⚡ _(demonstrated)_
- EDR unhooking and direct/indirect syscalls
- Impair defenses / AMSI & EDR bypass / obfuscation
- Process injection and hollowing (CreateRemoteThread, process hollowing, APC, thread hijack)

### Execution
- Runtime skill/plugin composition privilege union ◆

### Exfiltration
- Exfiltration over removable / physical media

### Hardware / IoT / Firmware
- Secure-boot / chain-of-trust link bypass

### Lateral Movement
- Pass-the-hash / remote services / PsExec
- RDP session hijacking via tscon
- SSH agent-forwarding hijack and key-trust pivoting

### Persistence
- Account manipulation: SSH authorized_keys and cloud IAM credential addition
- Boot/logon autostart, scheduled task
- New service creation and service binary/path hijack
- WMI event subscription persistence

### Privilege Escalation
- UAC bypass via auto-elevate hijack and elevated COM moniker

## P5 Format-Boundary *(18)*

### AI / Agent Attacks
- Pickle/__reduce__ payload in serialized model artifact ⚡ _(demonstrated)_
- Residency-bound PII synthesized into a cross-region model response ⚡ _(plausible)_

### API & Business-Logic Abuse
- HTTP request smuggling
- MCP transport boundary desync / call smuggling ⚡ _(plausible)_

### Cloud Attacks
- Cache-key/authorization-input mismatch cross-tenant serve ⚡ _(demonstrated)_

### Command and Control
- DNS tunneling (iodine / dnscat2 / DNS over recursive resolvers)
- ICMP covert channel (icmptunnel / ptunnel / echo-payload C2)

### Cryptography & PKI
- Padding-oracle plaintext recovery and CBC bit-flipping

### Defense Evasion
- DNS over HTTPS and domain fronting for C2 evasion
- Unicode normalization / homoglyph abuse

### Execution
- Argument injection
- Zip/Tar slip / path traversal

### Exfiltration
- DNS exfiltration (encoded subdomain labels to attacker NS)
- Exfiltration over C2 / alternative protocol / web service
- Steganographic exfiltration (LSB image/audio embedding, doc metadata)

### Lateral Movement
- SOCKS proxy / protocol tunneling pivot (Chisel, Ligolo-ng, reverse SOCKS)

### Privilege Escalation
- Unquoted service path hijack

### Supply Chain
- Upgrade-time storage-slot re-interpretation seizing role/owner ⚡ _(demonstrated)_

## P6 Time/State *(34)*

### AI / Agent Attacks
- Confirmation-stream conditioning to harvest reflexive approval ⚡ _(plausible)_
- Poison-once / serve-many agent tool-result cache injection ⚡ _(plausible)_
- Secret regurgitation from persisted long-context / agent memory ⚡ _(plausible)_
- Shared prompt-prefix cache timing oracle for cross-request content inference ⚡ _(plausible)_

### API & Business-Logic Abuse
- Block-cadence warping of TWAP observation window ⚡ _(plausible)_
- Idempotency / race business-logic abuse
- Workflow / state-machine step skipping and forced browsing

### Automotive / CAN
- PKES relay attack (RF link extension)

### Cloud Attacks
- Cloud-trail / activity-log disable, delete, or selective filter
- Rotated-out lease accepted during downstream grace overlap ⚡ _(plausible)_

### Credential Access
- Password spraying and credential brute force across the auth surface

### Cryptography & PKI
- Coordinated clock skew widening cert validity acceptance ⚡ _(plausible)_
- Crypto-agility policy rollback to deprecated suite ⚡ _(speculative)_
- Hybrid keyshare strip forcing classical-only PQC fallback ⚡ _(plausible)_
- Stale TEE attestation replay against a verifier missing freshness/nonce binding ⚡ _(speculative)_
- TLS/SSH version and ciphersuite downgrade (FREAK, Logjam, POODLE-class)

### Defense Evasion
- Detection-model feedback-loop poisoning ⚡ _(plausible)_
- Event log clearing and selective record deletion
- Memory check-vs-use divergence after human correction ⚡ _(plausible)_
- Slow-drip behavioral baseline shifting against cloud UEBA/EDR ML scoring ⚡ _(speculative)_
- Timestomping of file MACE attributes

### Exfiltration
- Chunked, encrypted, rate-limited exfiltration

### Hardware / IoT / Firmware
- Voltage/clock/EM fault injection (auth & secure-boot skip)

### Identity & Federation Attacks
- MFA push bombing / prompt fatigue to harvest approval

### Impact
- Business-process disruption / availability denial

### Lateral Movement
- Replay attack

### Network Attacks
- Directional delay injection skewing PTP offset ⚡ _(demonstrated)_

### OT / ICS Attacks
- Safety controller manipulation / SIS bypass (Triton/TRISIS-class)
- Stale-telemetry replay suppressing automated safety response ⚡ _(demonstrated)_

### Persistence
- Vector-store eviction/poisoning persistence ⚡ _(speculative)_

### Privilege Escalation
- TOCTOU race condition

### Wireless / RF Attacks
- 802.11 deauthentication / disassociation flood
- Slow time-slew GNSS spoof under loss-of-lock threshold ⚡ _(plausible)_
- WPA2 4-way handshake capture & offline crack
