import { authUsers, expect } from '../fixtures/auth-users'

authUsers('admin panel is visible & accessible @6v6 @9v9 @4v4 @3v3', async ({ users }) => {
  const adminsPage = await users.getAdmin().page()
  await adminsPage.goto('/')
  await adminsPage.getByRole('link', { name: 'Admin panel' }).click()
  await adminsPage.waitForURL(/admin/)
})

authUsers('admin panel is not visible for non-admins @6v6 @9v9 @4v4 @3v3', async ({ users }) => {
  const userPage = await users.getNext(u => !u.isAdmin).page()
  await userPage.goto('/')
  await expect(userPage.getByRole('link', { name: 'Admin panel' })).not.toBeVisible()

  await userPage.goto('/admin')
  await expect(userPage.getByText('403')).toBeVisible()
  await expect(userPage.getByText('Forbidden')).toBeVisible()
  await expect(userPage.getByRole('link', { name: 'Go back home' })).toBeVisible()
})

authUsers(
  'admin panel is not visible for anonymous users @6v6 @9v9 @4v4 @3v3',
  async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Admin panel' })).not.toBeVisible()

    await page.goto('/admin')
    await expect(page.getByText('401')).toBeVisible()
    await expect(page.getByText('Unauthorized')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go back home' })).toBeVisible()
  },
)
;[
  '/admin/player-restrictions',
  '/admin/games',
  '/admin/map-pool',
  '/admin/game-servers',
  '/admin/voice-server',
  '/admin/discord',
  '/admin/view-for-nerds',
  '/admin/scramble-maps',
  '/admin/bypass-registration-restrictions',
  '/admin/rules',
  '/admin/privacy-policy',
].forEach(adminPage => {
  authUsers(
    `admin panel is not available for non-admins on ${adminPage} @6v6 @9v9 @4v4 @3v3`,
    async ({ users }) => {
      const userPage = await users.getNext(u => !u.isAdmin).page()
      await userPage.goto(adminPage)
      await expect(userPage.getByText('403')).toBeVisible()
      await expect(userPage.getByText('Forbidden')).toBeVisible()
      await expect(userPage.getByRole('link', { name: 'Go back home' })).toBeVisible()
    },
  )
})

authUsers(
  'games admin saves execute extra commands per queue @6v6 @9v9 @4v4 @3v3',
  async ({ users }) => {
    const adminPage = await users.getAdmin().page()
    await adminPage.goto('/admin/games')

    await adminPage
      .getByLabel('Execute extra commands (6v6)')
      .fill('sv_cheats 0\ntf_preround_time 5')
    await adminPage.getByRole('button', { name: 'Save' }).click()
    await expect(adminPage.getByText('Configuration saved')).toBeVisible()

    await adminPage.reload()
    await expect(adminPage.getByLabel('Execute extra commands (6v6)')).toHaveValue(
      'sv_cheats 0\ntf_preround_time 5',
    )
    await expect(adminPage.getByLabel('Execute extra commands (9v9)')).toHaveValue('')
    // the per-queue command preview renders the saved commands
    await expect(adminPage.getByText('tf_preround_time 5', { exact: true })).toBeVisible()

    // restore the previous empty configuration
    await adminPage.getByLabel('Execute extra commands (6v6)').fill('')
    await adminPage.getByRole('button', { name: 'Save' }).click()
    await expect(adminPage.getByText('Configuration saved')).toBeVisible()
  },
)
