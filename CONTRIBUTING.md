# Contributing to LIFX Raycast Extension

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- [Raycast](https://www.raycast.com/) installed
- Node.js 18+ installed
- At least one LIFX light on your network (for testing)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/luinbytes/lifx-raycast.git
cd lifx-raycast
```

2. Install dependencies:
```bash
npm install
```

3. Start development mode:
```bash
npm run dev
```

This will open Raycast with the extension in development mode. Changes you make will be reflected immediately.

## Project Structure

```
src/
├── dashboard.tsx                 # Main dashboard command with NLP support
├── index.tsx                   # Legacy simple list view (unused)
├── save-profile.tsx             # Save profile command
├── load-profile.tsx             # Load profile command
├── manage-profiles.tsx          # Manage profiles command
├── lib/
│   ├── lifx-client.ts           # Connection manager (LAN + HTTP)
│   ├── lifx-lan.ts              # LAN client wrapper
│   ├── lifx-http.ts             # HTTP client wrapper
│   ├── nlp-parser.ts            # Natural language parser
│   ├── storage.ts               # Profile storage (LocalStorage)
│   └── types.ts                # TypeScript interfaces
├── components/
│   ├── LightListItem.tsx         # Light list item with actions
│   ├── LightGridItem.tsx         # Light grid item with actions
│   ├── BrightnessControl.tsx     # Brightness picker
│   ├── ColorPicker.tsx           # Color picker
│   └── TemperatureControl.tsx    # Temperature picker
└── utils/
    └── validation.ts             # Input validation utilities
```

## Code Style

### TypeScript

We use TypeScript for type safety. All new code should include proper types:

```typescript
// Good
interface MyProps {
  title: string;
  onAction: () => void;
}

function MyComponent({ title, onAction }: MyProps) {
  // ...
}

// Bad
function MyComponent(props: any) {
  // ...
}
```

### React

We use React with hooks. Follow these patterns:

- Use functional components with hooks
- Use `useCallback` for event handlers to prevent unnecessary re-renders
- Use `useMemo` for expensive computations

```typescript
// Good
const handleClick = useCallback(() => {
  doSomething();
}, [dependency]);

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

### Error Handling

Always handle errors gracefully with user-friendly messages:

```typescript
// Good
async function someAsyncOperation() {
  try {
    await doSomething();
    showToast({ style: Toast.Style.Success, title: "Success!" });
  } catch (error) {
    console.error("Operation failed:", error);
    showToast({
      style: Toast.Style.Failure,
      title: "Operation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
```

### LIFX Client Usage

Always use `LIFXClientManager` for light control:

```typescript
// Good
await client.controlLight(lightId, { brightness: 50 });

// Bad (don't use clients directly)
await lanClient.control(lightId, control);
```

The manager handles LAN/HTTP fallback automatically.

## Testing

### Manual Testing

Since Raycast extensions can't be easily tested with Jest, manual testing is required:

1. Start with `npm run dev`
2. Test all commands and actions
3. Test edge cases (no lights, network errors, etc.)
4. Test with both LAN and HTTP API

### Test Scenarios

- [ ] Light discovery works
- [ ] Control individual lights (power, brightness, color, temperature)
- [ ] Control all lights
- [ ] Natural language commands work
- [ ] Profile save/load/delete work
- [ ] Error handling shows helpful messages
- [ ] Fallback from LAN to HTTP works
- [ ] View switching (list/grid) works

## Commit Guidelines

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(nlp): add support for new color keywords
fix(lan): handle timeout errors gracefully
docs(readme): update installation instructions
```

### Pull Requests

1. Create a new branch for your feature:
```bash
git checkout -b feature/my-feature-name
```

2. Make your changes and commit them
3. Push to your fork:
```bash
git push origin feature/my-feature-name
```

4. Create a pull request with a clear description:
- What does this PR do?
- Why is it needed?
- How did you test it?

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md` (if it exists)
3. Create a PR with title: `Release vX.X.X`
4. After merge, the maintainer will publish to Raycast Store

## Questions?

Feel free to open an issue if you have questions or run into problems!
