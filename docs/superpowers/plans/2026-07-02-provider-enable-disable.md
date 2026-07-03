# Provider Enable/Disable & Gateway Participation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make enable/disable a real-time action that affects aggregation search scheduling, with provider status sourced from the `providers` table as the single source of truth.

**Architecture:** Service/repository layer reads DB and produces a normalized "available provider" list. Gateway consumes this list and handles dispatch only — it no longer filters by status or credentials. Provider-registry is a pure type→adapter mapping.

**Tech Stack:** TypeScript, Next.js App Router, Drizzle ORM (PostgreSQL/PGlite), Vitest, Testing Library, Tailwind CSS, shadcn/ui (Button, Toast, Dialog)

## Global Constraints

- All enable/disable API responses include the full `Provider` (for list) or `ProviderDetail` (for detail page) summary in the response body
- Error responses use `ErrorResponse` type consistently
- OS enable without active credential → 400 with `PROVIDER_CREDENTIAL_EXHAUSTED` error
- Xunlei enable always succeeds (no credential requirement)
- Disable succeeds for both provider types
- Enable/disable do NOT enter dirty state in frontend forms
- All frontend mutations: confirm dialog → pending button → server response → update UI
- No optimistic updates — UI updates only after server success
- Format: `pnpm format:write` before every commit
- Lint: `pnpm lint` before every commit

---

## File Structure

### New files to create:
- `src/server/providers/provider-candidates.ts` — `getEnabledCandidates()` function (extracted from gateway)

### Files to modify:
- `src/server/subtitles/subtitle-gateway.ts` — Replace inline `getProviderCandidates()` with call to service layer
- `src/server/services/provider-service.ts` — Add `getEnabledCandidates()` public method (thin wrapper)
- `src/server/providers/provider-repository.ts` — Ensure `findByStatus()` works with array input
- `src/app/(admin)/providers/providers-client.tsx` — Wire `onToggleEnable` handler with enableProvider/disableProvider API calls, confirm dialog, toast
- `src/app/(admin)/providers/[providerId]/provider-detail-client.tsx` — Add enable/disable inline controls with same pattern
- `src/components/providers/provider-list.tsx` — Refine enable/disable button with pending state

### Test files to modify:
- `tests/contract/providers.contract.test.ts` — Add enable/disable response contract tests
- `tests/unit/subtitles/subtitle-gateway.test.ts` — Add disabled skip / re-enable restore / all disabled error tests
- `tests/integration/subtitle-gateway-flow.test.ts` — Add gateway flow tests with toggled providers
- `tests/ui/providers-page.test.tsx` — Add enable/disable UI interaction tests
- `tests/ui/provider-detail-page.test.tsx` — Add detail page enable/disable tests

---

## Tasks

### Task 1: Extract candidate selection to service layer

**Files:**
- Create: `src/server/providers/provider-candidates.ts`
- Modify: `src/server/subtitles/subtitle-gateway.ts` (remove inline `getProviderCandidates`, import from service)
- Modify: `src/server/services/provider-service.ts` (add export of `getEnabledCandidates`)

**Interfaces:**
- Consumes: `ProviderRepository.listProviders(filter?, now?)` from repository layer
- Produces: `getEnabledCandidates(db, now?): Promise<Provider[]>` — returns providers with status "enabled" or "degraded", respecting type-aware credential requirements (OS requires `availableCredentialCount > 0`, Xunlei doesn't)

- [ ] **Step 1: Create `src/server/providers/provider-candidates.ts`**

```typescript
import { StorageDatabase } from "@/server/storage";
import { ProviderRepository } from "@/server/providers/provider-repository";
import { Provider } from "@/lib/api/generated/model/provider";

export type EnabledCandidate = Provider;

export async function getEnabledCandidates(
  db: StorageDatabase,
  now?: Date,
): Promise<EnabledCandidate[]> {
  const repository = new ProviderRepository(db);
  const allProviders = await repository.listProviders(undefined, now);

  return allProviders.filter((p) => {
    const qualifiesByStatus =
      p.status === "enabled" || p.status === "degraded";
    if (!qualifiesByStatus) return false;
    const credentialRelevant = (p.type as string) === "opensubtitles";
    const hasCredentials =
      !credentialRelevant || (p.availableCredentialCount ?? 0) > 0;
    return hasCredentials;
  });
}
```

- [ ] **Step 2: Export from `provider-service.ts`**

Add to `src/server/services/provider-service.ts`:

```typescript
export { getEnabledCandidates } from "@/server/providers/provider-candidates";
```

- [ ] **Step 3: Update gateway to consume candidates from service**

In `src/server/subtitles/subtitle-gateway.ts`, replace the inline `getProviderCandidates` function with an import. Remove inline function entirely, and update the call site.

Remove import of `ProviderRepository` (no longer needed) and `hasCredentials` (no longer needed).

- [ ] **Step 4: Run format and lint**

```bash
pnpm format:write
pnpm lint
```

- [ ] **Step 5: Run tests to verify nothing broke**

```bash
pnpm test -- --run
```

- [ ] **Step 6: Commit**

```bash
git add src/server/providers/provider-candidates.ts src/server/services/provider-service.ts src/server/subtitles/subtitle-gateway.ts
git commit -m "refactor: extract candidate selection to service layer"
```

---

### Task 2: Ensure provider repository supports status-based queries

**Files:**
- Modify: `src/server/providers/provider-repository.ts` (verify/update `findByStatus` signature)

**Interfaces:**
- Consumes: none
- Produces: `findByStatus(status: Provider["status"] | Provider["status"][], now?): Promise<Provider[]>`

- [ ] **Step 1: Check existing `findByStatus` — ensure array support**

- [ ] **Step 2: Run format and lint**

```bash
pnpm format:write
pnpm lint
```

- [ ] **Step 3: Commit (or skip if no changes needed)**

---

### Task 3: Contract test for enable/disable API

**Files:**
- Modify: `tests/contract/providers.contract.test.ts`

**Interfaces:**
- Consumes: API routes `POST enable` and `POST disable`
- Produces: Tests for response shape, error codes, state transitions

- [ ] **Step 1: Read existing contract test structure**

```bash
head -80 tests/contract/providers.contract.test.ts
```

- [ ] **Step 2: Add enable/disable contract tests**

```typescript
describe("enable / disable contract", () => {
  it("returns full provider summary on enable success");
  it("returns full provider summary on disable success");
  it("returns 400 when enabling OS without active credential");
  it("returns 404 when enabling non-existent provider");
  it("returns 409 when provider is already in target state");
});
```

- [ ] **Step 3: Run the contract tests**

```bash
pnpm test -- --run tests/contract/providers.contract.test.ts
```

- [ ] **Step 4: Format, lint and commit**

```bash
pnpm format:write
pnpm lint
git add tests/contract/providers.contract.test.ts
git commit -m "test: add enable/disable API contract tests"
```

---

### Task 4: Gateway tests for disabled provider handling

**Files:**
- Modify: `tests/unit/subtitles/subtitle-gateway.test.ts`
- Modify: `tests/integration/subtitle-gateway-flow.test.ts`

**Interfaces:**
- Consumes: `getEnabledCandidates()` and `searchSubtitles()`
- Produces: Tests for disabled skip, re-enable restore, all-disabled error

- [ ] **Step 1: Add unit tests for disabled provider handling**

```typescript
describe("disabled provider handling", () => {
  it("skips disabled providers without adding to provider_failures");
  it("re-enables a previously disabled provider to restore scheduling");
  it("throws SERVICE_NOT_READY when all providers are disabled");
});
```

- [ ] **Step 2: Add integration test for full flow**

```typescript
it("completes flow: enable→search→disable→search fails");
it("completes flow: disabled→enabled→search succeeds");
```

- [ ] **Step 3: Run tests**

```bash
pnpm test -- --run
```

- [ ] **Step 4: Format, lint and commit**

```bash
pnpm format:write
pnpm lint
git add tests/unit/subtitles/subtitle-gateway.test.ts tests/integration/subtitle-gateway-flow.test.ts
git commit -m "test: add gateway disabled provider handling tests"
```

---

### Task 5: Connect enable/disable in providers page

**Files:**
- Modify: `src/app/(admin)/providers/providers-client.tsx`
- Modify: `src/components/providers/provider-list.tsx`

**Interfaces:**
- Consumes: `enableProvider(id)`, `disableProvider(id)` from `@/lib/api/providers`
- Produces: Wire onToggleEnable with confirm dialog + pending state + server-sync

- [ ] **Step 1: Add confirm dialog + enable/disable handler in `providers-client.tsx`**

State:
```typescript
const [toggleConfirm, setToggleConfirm] = useState<Provider | null>(null);
const [togglingId, setTogglingId] = useState<string | null>(null);
```

Handler:
```typescript
const handleToggleEnable = useCallback((providerId: string) => {
  const provider = providers.find(p => p.id === providerId);
  if (provider) setToggleConfirm(provider);
}, [providers]);
```

Confirm action:
```typescript
const confirmToggle = useCallback(async () => {
  if (!toggleConfirm) return;
  const id = toggleConfirm.id;
  const isEnabled = toggleConfirm.status === "enabled" || toggleConfirm.status === "degraded";
  setTogglingId(id);
  setToggleConfirm(null);
  try {
    isEnabled ? await disableProvider(id) : await enableProvider(id);
    void loadProviders();
  } catch (err) {
    toast({ title: "操作失败", description: ..., variant: "destructive" });
  } finally {
    setTogglingId(null);
  }
}, [toggleConfirm, loadProviders]);
```

- [ ] **Step 2: Update `ProviderListProps` in `provider-list.tsx` to accept `togglingProviderId`**

- [ ] **Step 3: Run format, lint and tests**

```bash
pnpm format:write
pnpm lint
pnpm test -- --run
```

- [ ] **Step 4: Commit**

---

### Task 6: Add enable/disable controls to provider detail page

**Files:**
- Modify: `src/app/(admin)/providers/[providerId]/provider-detail-client.tsx`

**Interfaces:**
- Consumes: `enableProvider(id)`, `disableProvider(id)` from `@/lib/api/providers`
- Produces: Enable/disable button group in detail page header + confirm dialog
- Constraint: Does NOT enter dirty state

- [ ] **Step 1: Add toggle state and handlers in detail page**

- [ ] **Step 2: Add AlertDialog for confirmation**

- [ ] **Step 3: Add enable/disable buttons in header area**

- [ ] **Step 4: Run format and lint**

```bash
pnpm format:write
pnpm lint
```

- [ ] **Step 5: Commit**

---

### Task 7: UI tests for enable/disable interactions

**Files:**
- Modify: `tests/ui/providers-page.test.tsx`
- Modify: `tests/ui/provider-detail-page.test.tsx`

- [ ] **Step 1: Add provider page UI tests** (confirm dialog, pending, success sync, failure)

- [ ] **Step 2: Add detail page UI tests** (confirm dialog, no dirty state)

- [ ] **Step 3: Run tests**

```bash
pnpm test -- --run
```

- [ ] **Step 4: Format, lint and commit**

---

## Execution Order

1. **Task 1** → Candidate extraction (refactor, no behavior change)
2. **Task 2** → Repository support (verify)
3. **Task 3** → Contract tests (verify API shape)
4. **Task 4** → Gateway tests (depends on Task 1)
5. **Task 5** → List page enable/disable UI
6. **Task 6** → Detail page enable/disable UI
7. **Task 7** → UI tests (depends on Tasks 5 & 6)
