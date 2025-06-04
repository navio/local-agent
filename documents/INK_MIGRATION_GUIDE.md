# Migration Guide: Moving the Local Agent CLI to Ink

This document outlines the steps, considerations, and strategies for migrating the local agent CLI project to use [Ink](https://github.com/vadimdemedes/ink), a React-based library for building interactive command-line interfaces.

---

## 1. What to Replace

### a. CLI Output and Input

- **Replace:**  
  - All `console.log`-based output (including color formatting with ANSI codes).
  - All `readline`-based user input and prompt loops.
  - Spinner/status animations written manually.
  - Markdown rendering via `marked-terminal`.

- **With:**  
---

## 2a. Detailed Migration of Key Elements

### Animation (Spinners, Progress Bars, Status)

- **Current:** Manual spinner logic using `setInterval` and `console.log`.
- **With Ink:** Use Ink's `<Spinner />` component (from `ink-spinner`), or community progress bar components (e.g., `ink-progress-bar`).
- **Example:**
  ```tsx
  import { Text } from 'ink';
  import Spinner from 'ink-spinner';

  const Loading = () => (
    <Text color="yellow">
      <Spinner type="dots" /> Thinking...
    </Text>
  );
  ```
- **Progress Bars:** Use `ink-progress-bar` for visual progress.
  ```tsx
  import ProgressBar from 'ink-progress-bar';

  <ProgressBar percent={progress} />
  ```

### User Input (Prompts, Forms, Navigation)

- **Current:** `readline` for line-by-line input, manual prompt display.
- **With Ink:** Use the `useInput` hook for keypress handling, or community components like `ink-text-input`, `ink-select-input`, and `ink-form`.
- **Example:**
  ```tsx
  import { useInput, Text } from 'ink';
  import TextInput from 'ink-text-input';

  const Prompt = ({ onSubmit }) => {
    const [value, setValue] = React.useState('');
    useInput((input, key) => {
      if (key.return) onSubmit(value);
    });
    return (
      <>
        <Text>Enter your command: </Text>
        <TextInput value={value} onChange={setValue} onSubmit={onSubmit} />
      </>
    );
  };
  ```
- **Lists/Navigation:** Use `ink-select-input` for menus or option selection.

### Coloring (Text, Status, Errors)

- **Current:** ANSI color codes (e.g., `\x1b[32m` for green).
- **With Ink:** Use the `color` prop on `<Text>` for built-in colors (`red`, `green`, `yellow`, `blue`, etc.).
- **Example:**
  ```tsx
  import { Text } from 'ink';

  <Text color="green">Success!</Text>
  <Text color="red">Error: Something went wrong.</Text>
  <Text color="yellow">Warning: Check your config.</Text>
  ```
---

## 4a. Phased Migration Plan

A step-by-step approach to safely migrate to Ink while maintaining stability and test coverage.

### **Phase 1: Preparation**

- Review all CLI entry points and interactive flows.
- Inventory all uses of `console.log`, `readline`, color codes, and markdown rendering.
- Identify and document all current CLI tests.
- Install Ink and related dependencies (`ink`, `react`, `ink-markdown`, etc.).
- Set up `ink-testing-library` for component testing.

### **Phase 2: Isolate Core Logic**

- Refactor business logic (configuration, file I/O, tool loading) into pure functions/modules, decoupled from CLI/UI code.
- Add or update unit tests for these modules to ensure correctness independent of UI.

### **Phase 3: Incremental UI Migration**

- Create a new Ink-based root component (e.g., `App`).
- Migrate one CLI feature or command at a time to Ink components:
  - Replace output with `<Text>` and `<Box>`.
  - Replace input with `useInput` or `ink-text-input`.
  - Replace spinners/status with Ink components.
  - Replace markdown rendering with `ink-markdown`.
- For each migrated feature:
  - Add/port component tests using `ink-testing-library`.
  - Run existing CLI tests to ensure no regressions.

### **Phase 4: Integration and Testing**

- Integrate all migrated features into the new Ink-based CLI entry point.
- Run full test suite (unit, integration, CLI, and component tests).
- Manually test interactive flows for usability and correctness.
- Address any regressions or UI/UX issues.

### **Phase 5: Cleanup and Launch**

- Remove legacy CLI code and unused dependencies (e.g., `readline`, `marked-terminal`).
- Update documentation and usage instructions.
- Announce and release the new Ink-based CLI.

---

**Tip:**  
You can run the legacy CLI and the new Ink CLI side-by-side during migration by using separate entry points or feature flags, allowing for gradual adoption and easier rollback if needed.

---

### Testing (Component and CLI Testing)

- **Current:** Jest for logic and CLI process tests, possibly using mocks for `readline` and `console.log`.
- **With Ink:** Use [`ink-testing-library`](https://github.com/vadimdemedes/ink-testing-library) to render components, simulate input, and assert on output.
- **Example:**
  ```ts
  import { render } from 'ink-testing-library';
  import React from 'react';
  import App from './App';

  test('shows spinner and then result', async () => {
    const { lastFrame, rerender } = render(<App loading={true} />);
    expect(lastFrame()).toContain('Thinking...');
    rerender(<App loading={false} />);
    expect(lastFrame()).toContain('Done!');
  });
  ```
- **Simulating Input:** Use `stdin.write()` to simulate user keystrokes in tests.
- **Strategy:**  
  - Test UI logic as React components.
  - Keep non-UI logic in separate modules for traditional unit testing.

---
  - Ink components and JSX for all terminal output.
  - Ink's `useInput` and component state for user input and interactivity.
  - Ink's `<Text>`, `<Box>`, `<Spinner>`, and community components for UI.
  - Ink-compatible Markdown renderer (e.g., `ink-markdown`).

### b. Libraries to Replace

| Current Library/Pattern      | Replacement with Ink         |
|-----------------------------|-----------------------------|
| `readline` (Node.js)        | Ink's `useInput` hook       |
| `console.log` + ANSI colors | Ink's `<Text color="...">`  |
| `marked-terminal`           | `ink-markdown` or similar   |
| Manual spinners             | `<Spinner />` from Ink      |

---

## 2. What to Enhance

- **Richer UI:**  
  - Use Ink components to create interactive lists, forms, and status displays.
  - Provide real-time feedback, progress bars, and error messages in a more user-friendly way.
  - Support for keyboard shortcuts and navigation.

- **Improved User Experience:**  
  - More intuitive prompts and responses.
  - Better error handling and display.
  - Dynamic updates to the UI without clearing/repainting the terminal manually.

- **Componentization:**  
  - Modularize CLI logic into reusable React components.
  - Easier to maintain and extend.

---

## 3. Testing Strategy

### a. Keeping Existing Tests

- **Unit Tests:**  
  - Retain logic tests for configuration, file loading, and tool initialization.
  - Refactor tests that depend on `readline` or `console.log` to mock Ink component props or state.

- **Integration/CLI Tests:**  
  - If you have end-to-end CLI tests (e.g., using Jest and child processes), adapt them to invoke the Ink-based CLI and assert on terminal output.

### b. Testing Ink Components

- **Use [`ink-testing-library`](https://github.com/vadimdemedes/ink-testing-library):**  
  - Write component-level tests for UI logic, state transitions, and output.
  - Simulate user input and assert on rendered output.

- **Strategy:**  
  - Test core logic separately from UI (as before).
  - Add new tests for interactive UI components.

---

## 4. Migration Steps

1. **Install Ink and Dependencies**
   ```sh
   npm install ink react ink-markdown
   ```

2. **Refactor CLI Entry Point**
   - Replace the imperative CLI entry (e.g., `main()` in [`src/cli.ts`](src/cli.ts:91)) with Ink's `render(<App />)`.

3. **Componentize UI**
   - Create a root `App` component.
   - Move prompt loop, status display, and output logic into React components.
   - Use Ink's hooks for input and state.

4. **Replace Output Formatting**
   - Replace all color constants and `console.log` calls with Ink's `<Text color="...">` and `<Box>`.

5. **Replace Markdown Rendering**
   - Swap `marked-terminal` for `ink-markdown` or a similar Ink-compatible renderer.

6. **Replace Spinners and Status**
   - Use Ink's `<Spinner />` or community spinner components.

7. **Refactor Interactive Session**
   - Move the logic from [`src/interactions.ts`](src/interactions.ts:1) into Ink components.
   - Use state and props to manage conversation history, task context, and tool status.

8. **Update Tests**
   - Refactor or mock CLI tests as needed.
   - Add Ink component tests using `ink-testing-library`.

---

## 5. Summary Table

| Area                | Current Implementation         | With Ink                        |
|---------------------|-------------------------------|---------------------------------|
| Output              | `console.log`, ANSI colors    | `<Text>`, `<Box>`, JSX          |
| Input               | `readline`                    | `useInput`, component state     |
| Markdown Rendering  | `marked-terminal`             | `ink-markdown`                  |
| Spinners/Status     | Manual, `console.log`         | `<Spinner />`                   |
| Testing             | Jest, CLI process tests       | Jest, `ink-testing-library`     |

---

## 6. Additional Notes

- **Dependencies:**  
  - Ink and React will increase your dependency size, but bring modern UI paradigms to the CLI.
- **Cross-Platform:**  
  - Ink is Node.js-specific; ensure your deployment targets Node environments.
- **Incremental Migration:**  
  - You can migrate one command or feature at a time by wrapping legacy logic in Ink components.

---

## 7. References

- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library)
- [ink-markdown](https://github.com/cameronhunter/ink-markdown)