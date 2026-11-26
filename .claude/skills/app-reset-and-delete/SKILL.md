---
name: app-reset-and-delete
description: The actions that destroy an app's work and cannot be undone — "delete this app", "remove the app for good", "reset the app", "start over from scratch", "wipe everything and begin again", "remove the payments account", "close my Stripe account and start payments over". Load only when the app builder asks for one of these in plain words. NOT for taking the app offline for a while (`app-management`), undoing one build (`revertBuild`), or deleting one record or file.
allowed-tools: deleteApp resetApp removePaymentsAccount
metadata:
  agents: [coach]
---

# Deleting and resetting the app

Every tool here acts on the app of this conversation, and each is held until the app builder types the app's exact name back: a "yes" or an "ok" does nothing, and the held result tells you how to ask. Say plainly, before they answer, what goes and that nothing brings it back. Never call one on your own reading of a frustrated message; the ask has to be in plain words.

- `deleteApp` removes the app for good: the App preview, the Published app, its data, files, app users, domains and chats. It refuses while Stencil still bills an app user for the app, naming who to cancel first. After it runs, this conversation ends: there is no app left to talk about, so say so in one line and stop.
- `resetApp` keeps the app, its name, its address and its settings but wipes every saved version, the data model, the records, the files, the app's database and every other chat. The founding prompt is handed back so the first build can be made again on the web; the reply says that in one line and sends them to the app's page there. It refuses when the workspace is out of credits, since the app could not be rebuilt.

Taking the app offline for a while is `updateAppSettings` in `app-management`. Undoing one build is `revertBuild`.

## The payments account

`removePaymentsAccount` closes the Stripe account Stencil created for the app and deletes its plans, products and billing settings, and retires its discount codes when the account is closed (they must then be created again after payments are set up again; an app on managed payments, or on the app builder's own Stripe account, which is only disconnected, keeps its codes), so payments can be set up again from nothing; it refuses once the account has taken any money. The same typed-name rule applies. Turning payments off for a while is a switch under More → Settings → Payments, not this.
