/**
 * The name shown for a user throughout the app.
 *
 * When the user has enabled `showRealName` and has a non-empty real name, their
 * real name is shown; otherwise their username is used. The result is stored in
 * the denormalized `User.displayName` column so every existing read path keeps
 * rendering the right name without extra joins.
 *
 * Note: dummy/leader-created players set `displayName` directly at creation
 * (their username is a random `_guest_…` value), so this helper is only used
 * when a user's own name preferences change.
 */
export function computeDisplayName(input: {
  username: string
  realName?: string | null
  showRealName?: boolean | null
}): string {
  const realName = input.realName?.trim()
  return input.showRealName && realName ? realName : input.username
}
