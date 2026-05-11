# Chronsole

Chronsole is a web-based terminal emulator built with Next.js, xterm.js, and Node.js `node-pty`. It provides a fully functional shell experience in your browser with support for real-time interaction via WebSockets.

## Features

- **Full Shell Access**: Real-time terminal access to your local machine (supports `/bin/zsh` on Unix and `powershell.exe` on Windows).
- **Interactive xterm.js UI**: High-perfomance terminal rendering in the browser.
- **Dynamic Resizing**: The terminal layout automatically adjusts to your browser window size.
- **WebSocket Communication**: Low-latency communication between the browser and the host shell.
- **Dark/Light Mode**: Styled with Tailwind CSS and `next-themes`.

## Tech Stack

- **Frontend**: [Next.js 15+](https://nextjs.org/), [React 19](https://react.dev/), [xterm.js](https://xtermjs.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: custom `server.js` using Node.js `http` module, [ws](https://github.com/websockets/ws) for WebSockets, and [node-pty](https://github.com/microsoft/node-pty) for pseudo-terminal emulation.

## Getting Started

### Prerequisites

- Node.js installed on your machine.
- Build tools (for `node-pty` compilation):
  - **Windows**: `npm install --global windows-build-tools` or Visual Studio Build Tools.
  - **macOS**: Xcode Command Line Tools.
  - **Linux**: Python, make, and a C++ compiler (e.g., `gcc`, `g++`).

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd chronsole
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Since this project uses a custom server for WebSocket and PTY support, you must use the provided server script:

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `server.js`: The core backend logic handling HTTP requests, WebSockets, and the PTY process.
- `app/`: Next.js App Router directory containing the main UI.
- `components/`: Reusable React components, including theme providers.

## Implementation Details

The application works by spawning a pseudo-terminal (PTY) on the server using `node-pty`. It then pipes the input/output of that terminal to the frontend via WebSockets. The frontend uses `xterm.js` to render the terminal sequence and capture keyboard input to send back to the server.

## Security Warning

**Caution**: This tool provides shell access to the host machine. It is designed for local development or controlled environments. Do not expose this server to the public internet without implementing robust authentication and encryption.
