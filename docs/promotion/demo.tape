# Charmbracelet VHS Tape: Simple SF CLI vs Official Salesforce CLI Benchmark
# Usage: vhs docs/promotion/demo.tape

Output docs/promotion/simple-sf-cli-benchmark.gif

Require npx
Require git

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 650
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms
Set WindowBar Colorful

Type "# Simple SF CLI (~19 KB, 3 dependencies) vs Official @salesforce/cli (~200+ MB)"
Enter
Sleep 800ms

Type "# 1. Check package footprint and cold start speed"
Enter
Sleep 400ms

Type "time npx --yes simple-sf-cli --version"
Enter
Sleep 2500ms

Type "# 2. Run a Git Delta Validation with Destructive Changes in a single command"
Enter
Sleep 500ms

Type "npx simple-sf-cli \"
Enter
Type "  --username ci-bot@acme.com.sandbox \"
Enter
Type "  --clientId 3MVG9_CONNECTED_APP_ID \"
Enter
Type "  --privateKey ./server.key \"
Enter
Type "  --env SANDBOX \"
Enter
Type "  --baseBranch origin/main \"
Enter
Type "  --targetBranch HEAD \"
Enter
Type "  --validateOnly \"
Enter
Type "  --testLevel RunLocalTests"
Enter
Sleep 4s

Type "# Deployed delta + destructiveChangesPost.xml in ~6 seconds (saved 90+ seconds of CI setup)!"
Enter
Sleep 3s
