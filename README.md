# Claude Code Mission Control

A lightweight project management interface for developers who run multiple Claude Code sessions simultaneously. 

![Screenshot](https://via.placeholder.com/800x600)

## Features

- 📊 **Unified Dashboard** - See all active Claude Code projects in one place
- ⚡ **Quick Commands** - Send commands to any project without switching windows
- 🎯 **Project Targeting** - Use `@project` syntax to target specific projects
- ⌨️ **Keyboard Shortcuts** - Power user focused with quick project switching
- 🔄 **Real-time Status** - Monitor process status and output
- 🚀 **Cursor Integration** - Open projects directly in Cursor IDE

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-mission-control.git
cd claude-mission-control

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run dist
```

## Usage

### Adding Projects

1. Click the "Add Project" button
2. Enter a project name and path
3. Click "Add Project"

### Sending Commands

- Type commands in the command bar
- Target specific projects with `@projectname command`
- Or use `@1`, `@2` etc. to target by number

### Keyboard Shortcuts

- `Cmd+K` - Focus command bar
- `Cmd+1-9` - Switch to project by number
- `↑/↓` - Navigate command history

## Development

### Tech Stack

- **Electron** - Desktop framework
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management

### Project Structure

```
├── electron/           # Electron main process
│   ├── main.ts        # Main entry point
│   ├── preload.ts     # Preload script
│   └── services/      # Core services
├── src/               # React renderer
│   ├── components/    # UI components
│   ├── stores/        # State management
│   └── types/         # TypeScript types
├── dist/              # Built files
└── release/           # Distribution packages
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration
```

## License

MIT