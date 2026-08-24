---
name: file-upload
description: File-upload UI in the next-saas-boilerplate monorepo — Dropzone primitive in @saas/ui, `useFileUpload` hook in apps/web, react-hook-form bridge. Use when adding an avatar/document picker, wiring a form, customizing the dropzone, debugging upload progress, or writing Storybook stories for storage-aware components.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# file-upload — Dropzone primitive + useFileUpload hook + RHF bridge

The UI half of the storage channel. For the **server side** (providers, presigned URLs, R2 setup), see `.claude/skills/storage/SKILL.md`.

Three layers, each composable on its own:

1. **`<Dropzone.*>`** in `@saas/ui` — headless compound primitive over `react-dropzone`. No upload logic. Just drop-area UI + file-list slots.
2. **`useFileUpload()`** in `apps/web/src/features/storage/hooks/` — state machine (queued → uploading → success/error), XHR with progress, Hono RPC presign + download URL flow, abort support.
3. **`<FileUpload>`** + **`<RHFFileUpload>`** in `apps/web/src/features/storage/components/` — composes layers 1 + 2; the RHF one adds a `Controller` wrapper.

Mix and match. Need a custom UI but the standard upload state? Use the primitive + the hook. Need standard everything? Use the connected component.

---

## When to reach for what

| Goal | Use |
| --- | --- |
| Avatar input bound to a form | `<RHFFileUpload name="avatar" control={form.control} accept={{"image/*":[]}} maxFiles={1} />` |
| Multi-file input (drag-drop, progress, remove) | `<FileUpload value={[]} multiple maxFiles={5} />` |
| Custom dropzone styling/behavior with default upload | `useFileUpload()` + `<Dropzone>` + your own list rendering |
| Pure UI demo (Storybook, designer review) | `<Dropzone>` primitives standalone — no hook, no Hono RPC |
| Server-side write (no user picker) | Skip this skill — call `storage.disk().put(...)` directly |

---

## Composition recipes

### Avatar (single image, RHF)

```tsx
const form = useForm<{ avatar: string[] }>({ defaultValues: { avatar: [] } });

<RHFFileUpload
  name="avatar"
  control={form.control}
  accept={{ "image/*": [] }}
  maxFiles={1}
  maxSize={5 * 1024 * 1024}
  label="Subí tu foto"
  description="JPG, PNG hasta 5MB"
/>

// Submit:
form.handleSubmit((values) => {
  // values.avatar is string[] — for a single field, take the first URL
  const avatarUrl = values.avatar[0] ?? null;
  saveCustomerAvatar({ url: avatarUrl });
});
```

### Multi-file (controlled)

```tsx
const [urls, setUrls] = useState<string[]>([]);

<FileUpload
  value={urls}
  onChange={setUrls}
  multiple
  maxFiles={5}
  maxSize={20 * 1024 * 1024}
  label="Subí documentos"
  description="Hasta 5 archivos, 20MB cada uno"
/>
```

### Custom UI with the hook

```tsx
import { Dropzone, DropzoneArea, DropzoneList, DropzoneListItem } from "@saas/ui";
import { useFileUpload } from "@/features/storage/hooks/use-file-upload";

function MyCustomUploader() {
  const fu = useFileUpload({
    accept: { "application/pdf": [] },
    maxSize: 10 * 1024 * 1024,
    onSuccess: (entry) => console.log("uploaded", entry.url),
  });

  return (
    <Dropzone
      accept={{ "application/pdf": [] }}
      onDrop={(files) => fu.add(files)}
    >
      <DropzoneArea>
        <p>{fu.isUploading ? "Subiendo…" : "Subí tu PDF"}</p>
      </DropzoneArea>
      <DropzoneList>
        {fu.entries.map((e) => (
          <DropzoneListItem
            key={e.id}
            name={e.file.name}
            size={e.file.size}
            contentType={e.file.type}
            progress={e.progress}
            status={e.status}
            errorMessage={e.error ?? undefined}
            onRemove={() => fu.remove(e.id)}
          />
        ))}
      </DropzoneList>
    </Dropzone>
  );
}
```

### Pure Dropzone (no upload — Storybook / designer review)

```tsx
<Dropzone onDrop={(files) => console.log(files)}>
  <DropzoneArea>
    <DropzoneIcon />
    <DropzoneLabel>Drop a file here</DropzoneLabel>
    <DropzoneDescription>Any type, no upload, just UI</DropzoneDescription>
  </DropzoneArea>
</Dropzone>
```

---

## `useFileUpload` API

```ts
const fu = useFileUpload({
  accept?: Record<string, readonly string[]>,
  maxSize?: number,           // bytes; pre-flight + server-enforced
  disk?: string,              // default: the manager's default disk
  onSuccess?: (entry) => void,
  onError?: (entry) => void,
});

// Surface:
fu.entries: FileUploadEntry[]       // every file currently in the upload state machine
fu.add(files: File[]): void          // kicks off uploads; entries enter "queued" → "uploading"
fu.remove(id: string): void          // aborts XHR if in-flight, drops from state
fu.clear(): void                     // aborts all + clears
fu.isUploading: boolean              // any entry in queued/uploading
fu.successUrls: string[]             // URLs of successful uploads in entry order
```

### Entry lifecycle

```
add() called
   │
   ▼
queued (progress: 0)
   │   api.storage.createUploadUrl.$post(...)
   ▼
uploading (progress: 0..100)
   │   XHR PUT + upload.onprogress
   ▼
   ├─ 2xx → api.storage.createDownloadUrl.$post(...) → success (url set)
   └─ failure → error (error set)
```

Aborts are clean — calling `remove(id)` while uploading cancels the XHR and the server's presigned URL just expires.

---

## react-hook-form integration

Two paths:

### Controlled via `<Controller>` (recommended)

The `<RHFFileUpload>` wrapper does this for you — uses `<Controller>` internally and passes `value` / `onChange` to `<FileUpload>`. Submits as `string[]` (array of download URLs). For single-file fields, take `values.field[0]`.

### Plain `register` (uncontrolled)

NOT recommended for our flow — react-hook-form's `register` returns a `FileList`, not URLs. You'd need to manage the upload yourself, then transform. Use `<Controller>` instead.

---

## Custom styling

`<Dropzone>` primitives accept `className`. The state classes (idle / active / accept / reject / disabled) are applied automatically via `class-variance-authority`. To override per state, wrap the children in your own conditional logic and read the `DropzoneContext` via custom hook (see `dropzone.tsx` source).

For full restyling, copy the primitive into `apps/web/src/components/` and adapt — `@saas/ui` uses the shadcn copy-paste model so this is the supported customization path.

---

## Storybook story map

`apps/storybook/stories/dropzone.stories.tsx`:
- `Default` — empty state
- `ImagesOnly` — accept + maxFiles
- `Disabled` — disabled state
- `WithFileList` — mixed states (success / uploading / error)
- `SingleItemStates` — each `DropzoneListItem` status in isolation

Stories use **mock data** — no real network. Drop a new story alongside if you add a feature variant.

---

## Common pitfalls

- **`accept` shape**: object whose keys are MIME types and values are arrays of extensions. `{ "image/*": [] }` accepts any image. `{ "image/png": [".png"] }` is more strict. See `react-dropzone` docs for the full grammar.
- **Forgetting `maxSize`** — without it, users can upload arbitrary garbage. The hook enforces pre-flight, the route handler enforces server-side. Set it.
- **CORS on R2** — failed uploads in prod often trace to CORS misconfiguration. See the storage skill for the bucket setup checklist.
- **Single-file forms** — `<RHFFileUpload maxFiles={1}>` still stores as `string[]`. Take `values.field[0]` at submit. Don't try to make it return a single string — keeping the type uniform makes the component simpler.
- **AbortController cleanup** — the hook handles this on unmount via the `useEffect` cleanup function. If you copy the hook for a custom variant, preserve that.
- **Object URLs for previews** — the hook calls `URL.createObjectURL` for image thumbnails during upload and `URL.revokeObjectURL` on remove/unmount. Don't reuse the previewUrl after the entry is removed.
- **Calling `add()` from a `useEffect`** — it won't fire react-dropzone's `onDrop`. Use the `<Dropzone onDrop={fu.add}>` wiring directly; the hook isn't meant to be triggered programmatically.

---

## See also

- `.claude/skills/storage/SKILL.md` — server-side providers, presigned URL mechanics, R2 setup
- `.claude/skills/ui/SKILL.md` — how to add/customize shadcn-style primitives
- `react-dropzone` docs: https://react-dropzone.js.org/ (the underlying lib)
- `react-hook-form` `<Controller>` docs: https://react-hook-form.com/api/usecontroller/controller
