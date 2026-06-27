# Issue Overview: Comment Author Lacks Avatar Display

## Status

✅ **Fixed** — 2026-06-26

## Symptom

In the issue overview panel, comment authors were displayed as plain text (e.g., `@johndoe` or `John Doe (@johndoe)`) without any user avatar image or initials fallback. This made it harder to visually identify who wrote each comment.

In contrast, pull request comments in the same extension already displayed avatars correctly.

## Root Cause

In `src/view/issueOverview/issueOverviewHtml.ts`, the `renderCommentAuthor` function only rendered the author's name/login as a text button or span — it did not render an avatar at all:

```ts
function renderCommentAuthor(author: IssueComment['author']): string {
    const display = author.name && author.name !== author.login
        ? `${escapeHtml(author.name)} (@${escapeHtml(author.login)})`
        : `@${escapeHtml(author.login)}`;
    if (author.htmlUrl) {
        return `<button ...>${display}</button>`;
    }
    return `<span>${display}</span>`;
}
```

The data pipeline was fully functional — `avatarUrl` was correctly mapped from the API (`avatar_url`) to the domain model (`IssueCommentAuthor.avatarUrl`) in `src/gitcode/mappers/issueCommentMapper.ts`. The problem was purely a rendering omission: no avatar-rendering function existed, and the comment header in `renderIssueComment` only called `renderCommentAuthor`.

The PR overview equivalent (`src/view/overview/overviewHtml.ts`) had a separate `renderCommentAvatar` function with the correct logic, but it was never added to the issue overview HTML generator.

## Fix

Three changes were made to `src/view/issueOverview/issueOverviewHtml.ts`:

### 1. Added `renderCommentAvatar` function

```ts
function renderCommentAvatar(author: IssueComment['author']): string {
    if (author.avatarUrl) {
        try {
            const url = new URL(author.avatarUrl);
            if (url.protocol === 'https:') {
                return `<img class="comment-avatar" src="${escapeHtml(author.avatarUrl)}" 
                  alt="${escapeHtml(author.login)}" loading="lazy" 
                  onerror="...initials fallback...">`;
            }
        } catch {
            // Fall through to initials for malformed API data.
        }
    }
    const initial = (author.name || author.login)[0]?.toUpperCase() || '?';
    return `<span class="avatar-initials">${escapeHtml(initial)}</span>`;
}
```

- Displays the avatar `<img>` when `avatarUrl` is a valid `https:` URL.
- Falls back to a styled initial-letter circle (`<span class="avatar-initials">`) when no avatar URL is available or the image fails to load (`onerror` handler).
- Gracefully handles malformed URLs via try/catch.

### 2. Updated `renderIssueComment` to include the avatar

```ts
return `<div class="comment">
    <div class="comment-header">
        ${renderCommentAvatar(comment.author)}      <!-- NEW -->
        ${renderCommentAuthor(comment.author)}
        ...
    </div>
    ...
</div>`;
```

### 3. Added CSS styles for avatar elements

```css
.comment-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
}
.avatar-initials {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 30%, transparent);
    font-size: 13px;
    font-weight: 600;
}
```

These styles match the existing PR comment avatar styles in `overviewHtml.ts` exactly.

## Behavior After Fix

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| User has valid HTTPS avatar URL | `@johndoe` (text only) | 🖼️ Circular avatar image + `@johndoe` |
| Avatar image fails to load | `@johndoe` (text only) | 🔤 Initial letter circle (`J`) + `@johndoe` |
| No avatar URL in API response | `@johndoe` (text only) | 🔤 Initial letter circle (`J`) + `@johndoe` |
| Malformed avatar URL | `@johndoe` (text only) | 🔤 Initial letter circle (`J`) + `@johndoe` |

## Affected Files

| File | Change |
|------|--------|
| `src/view/issueOverview/issueOverviewHtml.ts` | Added `renderCommentAvatar`, updated `renderIssueComment`, added CSS |

## Verification

- TypeScript compilation passes
- Issue comment avatars now display consistently with PR comment avatars
- Fallback to initials works for users without avatars or with broken avatar URLs
