# Terminal Companion Mode

## Overview

The agent CLI now functions as a true terminal companion, intelligently detecting and executing standard terminal commands while still providing AI assistance for conversational prompts. This enhancement creates a seamless experience where users can interact with both the terminal and the AI agent in a single interface.

## How It Works

### Terminal Command Detection

When a user inputs text, the system analyzes it to determine if it's a terminal command:

1. **Known Command Detection**: Checks against a comprehensive list of common terminal commands
2. **Path Detection**: Identifies paths (relative or absolute) that indicate executable files
3. **Pattern Recognition**: Recognizes shell patterns like pipes, redirections, and environment variable assignments
4. **PATH Searching**: Scans the system PATH for executables matching the command

### Command Handling Flow

1. User enters input
2. System checks if input is a terminal command
   - If YES: Executes command directly in the shell
   - If NO: Processes as normal AI agent prompt
3. Results are displayed and logged in the session history

### Special Command Handling

- **Directory Navigation**: The `cd` command properly updates the working directory for subsequent commands
- **Environment Variables**: Preserves and passes through environment variable assignments
- **Interactive Commands**: Properly attaches stdin/stdout for interactive terminal tools

## Benefits

- **Single Interface**: Eliminates switching between terminal and agent
- **Context Awareness**: AI responses know the current working directory
- **Natural Workflow**: Use the terminal normally while having AI assistance available
- **Seamless History**: All commands and responses are logged together in the session history

## Example Usage

```
# Terminal command - executed directly
$> ls -la
total 112
drwxr-xr-x  17 user  staff   544 Jun 1 14:23 .
drwxr-xr-x   8 user  staff   256 May 29 09:11 ..
-rw-r--r--   1 user  staff  2190 Jun 1 14:23 README.md
drwxr-xr-x   3 user  staff    96 Jun 1 14:23 bin
-rw-r--r--   1 user  staff  1524 Jun 1 14:23 cli.ts
...

# Normal AI prompt - processed by model
$> How can I optimize this code to run faster?
Let me analyze your code and suggest some optimizations. First, I notice...

# Mixed workflow - navigate, then ask for AI help
$> cd src
Changed directory to /Users/user/project/src

$> ls
components/  pages/  styles/  utils/  app.ts

$> How should I structure the components folder?
For React component organization, I recommend a structure that balances...
```

## Supported Terminal Commands

The system recognizes a wide range of standard terminal commands including:

- **File System**: ls, cd, pwd, mkdir, rm, cp, mv, cat, etc.
- **Navigation**: cd, pushd, popd, dirs
- **Package Managers**: npm, yarn, pnpm, bun, pip, cargo, etc.
- **Version Control**: git, svn, hg
- **Process Management**: ps, top, kill
- **Network Tools**: ping, curl, wget, ssh
- **System Commands**: echo, date, whoami, hostname
- **Text Processing**: grep, awk, sed, diff
- **Archiving**: tar, gzip, zip, unzip

And many more, including any executable found in the system PATH.

## Technical Implementation

- Command detection in `terminal-commands.ts`
- Execution pipeline with special handling for builtin commands
- Integration with the existing prompt processing flow
- Working directory state management for consistent navigation
- Custom prompt style configuration via `prompt_style` in local-agent.json

### Customizing the Prompt

You can customize the CLI prompt by setting the `prompt_style` property in your `local-agent.json`:

```json
{
  "prompt_style": "\u001b[32mmy-agent> \u001b[0m",
  "model": "openai/gpt-4o-mini",
  "temperature": 0
}
```

This example sets a green prompt with custom text. You can use ANSI color codes:
- `\u001b[30m` - Black
- `\u001b[31m` - Red
- `\u001b[32m` - Green
- `\u001b[33m` - Yellow
- `\u001b[34m` - Blue
- `\u001b[35m` - Magenta
- `\u001b[36m` - Cyan
- `\u001b[37m` - White
- `\u001b[0m` - Reset (use at the end to restore normal text color)

### Using Your Native Shell Prompt

For the most authentic terminal experience, you can use your native shell's prompt (complete with colors, Git branch info, directory path, etc.):

1. Source the native-prompt script:
   ```bash
   source native-prompt.sh
   ```

2. Use the created alias:
   ```bash
   mragent
   ```

This approach:
- Captures your actual shell prompt (bash or zsh)
- Preserves all prompt elements (username, hostname, path, git info)
- Maintains colors and styling
- Works with custom prompt themes (oh-my-zsh, powerlevel10k, starship, etc.)

#### How It Works

The `native-prompt.sh` script:
1. Detects your shell (bash or zsh)
2. Captures the current prompt
3. Creates an environment variable with your prompt
4. Sets up an alias to launch the agent with your prompt

The agent reads this environment variable and uses it instead of the default prompt.

## Future Enhancements

- Command autocompletion
- Command history navigation
- Custom command aliases
- Deeper shell integration (job control, background processes)
- Enhanced tab completion with AI suggestions