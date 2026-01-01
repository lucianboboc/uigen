# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It uses Claude (Anthropic's AI) to generate React components based on natural language descriptions, displays them in a live preview using a virtual file system, and allows users to iterate on the components through chat.

## Key Commands

### Setup and Development
```bash
npm run setup          # Install dependencies, generate Prisma client, run migrations
npm run dev           # Start development server with Turbopack
npm run dev:daemon    # Start dev server in background, logs to logs.txt
npm test              # Run all tests with Vitest
npm run build         # Build for production
npm run lint          # Run ESLint
```

### Database
```bash
npx prisma generate   # Generate Prisma client (outputs to src/generated/prisma)
npx prisma migrate dev # Run database migrations
npm run db:reset      # Reset database (force)
```

### Testing
```bash
npm test                              # Run all tests in watch mode
npm test -- --run                     # Run tests once without watch
npm test -- path/to/test.test.tsx     # Run specific test file
```

## Architecture

### Virtual File System (`src/lib/file-system.ts`)

The core of UIGen is a **VirtualFileSystem** class that manages all generated code in memory. No files are written to disk during component generation.

- **In-memory file tree**: Uses `Map<string, FileNode>` to store files and directories
- **Path normalization**: All paths start with `/`, automatic parent directory creation
- **Operations**: create, read, update, delete, rename files/directories
- **Serialization**: Files are serialized as JSON for persistence in the database
- **Editor commands**: Implements `view`, `create`, `str_replace`, `insert` operations

**Important**: The virtual file system operates on the root route `/`. All generated component files use `@/` import alias (e.g., `import Counter from '@/components/Counter'`).

### AI Integration (`src/app/api/chat/route.ts`)

The `/api/chat` endpoint orchestrates AI-powered component generation:

1. **System prompt injection**: Adds generation instructions from `src/lib/prompts/generation.tsx`
2. **Virtual file system reconstruction**: Deserializes files from client state
3. **Model selection**: Uses Claude Haiku 4.5 via `src/lib/provider.ts`
   - Falls back to **MockLanguageModel** if `ANTHROPIC_API_KEY` is not set
   - Mock provider generates static components (counter, form, or card) in 4 steps
4. **Tool calling**: AI uses two tools to manipulate the file system:
   - `str_replace_editor`: View, create, replace strings, insert lines (defined in `src/lib/tools/str-replace.ts`)
   - `file_manager`: Rename or delete files/folders (defined in `src/lib/tools/file-manager.ts`)
5. **Project persistence**: Saves messages and file system state to database via Prisma after completion

### Preview System (`src/lib/transform/jsx-transformer.ts`)

Components are previewed by transforming JSX to JavaScript and loading it in an iframe:

1. **Babel transformation**: Transforms JSX/TSX to JavaScript using `@babel/standalone`
2. **Import map creation**: Generates ES module import map
   - Maps local files to blob URLs
   - Maps third-party packages to `https://esm.sh/`
   - Handles `@/` alias (points to root `/`)
   - Detects and removes CSS imports, collects styles
3. **Error handling**: Tracks syntax errors per file and displays them in preview
4. **HTML generation**: Creates preview HTML with:
   - Tailwind CSS via CDN
   - Import map with blob URLs
   - Collected CSS styles
   - Error boundary for runtime errors

**Entry point**: Every project must have `/App.jsx` as the root component.

### Context Providers (`src/lib/contexts/`)

Two React contexts manage application state:

**FileSystemContext** (`file-system-context.tsx`):
- Wraps a `VirtualFileSystem` instance
- Manages selected file state
- Provides CRUD operations with automatic UI refresh
- Handles tool calls from AI (syncs AI operations with UI)
- Auto-selects `/App.jsx` or first root file on mount

**ChatContext** (`chat-context.tsx`):
- Uses Vercel AI SDK's `useChat` hook
- Sends serialized file system to `/api/chat` endpoint
- Calls `handleToolCall` to sync AI file operations
- Tracks anonymous work via `anon-work-tracker.ts`

### Database Schema

**Schema location**: `prisma/schema.prisma` - Reference this file anytime you need to understand the structure of data stored in the database.

SQLite database with two models:

- **User**: Authentication (email/password with bcrypt)
- **Project**: Stores serialized messages and file system data
  - `messages`: JSON string of chat history
  - `data`: JSON string of serialized virtual file system
  - `userId`: Optional (supports anonymous users)

**Generated client location**: `src/generated/prisma` (not default `node_modules`)

### Authentication (`src/lib/auth.ts`)

- JWT-based auth using `jose` library
- Session stored in HTTP-only cookie
- Middleware (`src/middleware.ts`) validates tokens
- Anonymous users can create projects but can't persist them

## Component Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── [projectId]/page.tsx     # Project-specific editor view
│   ├── api/chat/route.ts        # AI chat endpoint
│   ├── layout.tsx               # Root layout
│   ├── main-content.tsx         # Home page content
│   └── page.tsx                 # Landing page
├── components/
│   ├── auth/                    # Authentication forms and dialogs
│   ├── chat/                    # Chat interface, message list, input, markdown renderer
│   ├── editor/                  # File tree and Monaco code editor
│   ├── preview/                 # Preview frame with JSX transformer
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── contexts/                # React context providers
│   ├── prompts/                 # AI system prompts
│   ├── tools/                   # AI tool definitions (file-manager, str-replace)
│   ├── transform/               # JSX transformer for preview
│   ├── auth.ts                  # JWT authentication
│   ├── file-system.ts           # Virtual file system implementation
│   ├── prisma.ts                # Prisma client singleton
│   └── provider.ts              # AI model provider (Claude or Mock)
├── actions/                     # Server actions (create/get projects)
└── hooks/                       # Custom React hooks
```

## Development Notes

### AI Generation Rules

From `src/lib/prompts/generation.tsx`:

- Every project must have `/App.jsx` as the default export
- Use Tailwind CSS for styling, not hardcoded styles
- No HTML files are created (React only)
- All local imports use `@/` alias (e.g., `@/components/Calculator`)
- Virtual file system root is `/`

### Import Alias

The `@/` alias maps to the project root. In `tsconfig.json`:
```json
"paths": {
  "@/*": ["./src/*"]
}
```

In the **virtual file system** during preview, `@/` maps to `/` (the virtual root).

### Testing

- Framework: Vitest with jsdom environment
- UI testing: React Testing Library
- Config: `vitest.config.mts`
- Test location: Co-located with source files in `__tests__/` folders

### Mock Provider Behavior

When `ANTHROPIC_API_KEY` is not set:

1. Returns static response message about API key
2. Generates one of three component types based on user prompt keywords:
   - "form" → ContactForm
   - "card" → Card
   - default → Counter
3. Executes exactly 4 steps: create App.jsx, create component, enhance component, final summary
4. Uses `maxSteps: 4` to prevent repetition
