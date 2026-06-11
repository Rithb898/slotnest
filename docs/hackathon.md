This is The Hackathon Document/Requirements for the Corsair Hackathon. Please read through all the details carefully before starting to build.

# SlotNest: Corsair Hackathon
Today Date: June 10, 2026 | Hackathon End Date: June 18, 2026

Build a command center for Gmail and Google Calendar.

## About

When you use Gmail or Google Calendar, it is likely that a regular workflow takes a few more clicks than it should. Or maybe sending a calendar invite is too many steps on the UI.

Many startups have tried to make managing email and calendar seamless, but this is hard to do because everyone uses it slightly differently.

**Corsair** provides the building blocks to hundreds of integrations. You can use those building blocks to wire your app into almost any other app. You can also use Corsair's MCP to let any agent get full access to integrations so it can do things on your behalf.

This means you can make new UIs that are set up exactly how you need, and power them using Corsair.

Use Corsair to create Gmail and Google Calendar integrations. Use the Gmail API to make it more intuitive to search, draft, send and receive emails. Use the Google Calendar API to make it easier to manage your schedule and send calendar invites and updates.

Once this is done, your email and calendar management will not be limited to how Google, Superhuman, or anyone else sees the way your workflows should be. Instead, you can decide exactly what needs to be more prominent.

### Tech stack

Next.js, Postgres and Corsair (Ngrok is optional and can be used for webhooks)

### Bonus tasks

1. Probably the most high-value bonus task is to add agent chat using the Corsair MCP. This will let users chat to send emails and calendar invites.
   **Example**: `"Send a calendar invite to friend@corsair.dev at 9 AM next Thursday. Send him an email too saying I look forward to our meeting."`

2. Use Corsair's built-in webhooks so you can get all new emails and calendar invites in realtime without having to poll the Google APIs
3. Add automatic email filtering by sending the email subject and body through a cheap LLM to determine priority level
4. Wire in keystrokes so users can do common actions via the keyboard instead of clicking around
5. Use the Corsair search API to add a better UI around Gmail advanced search
6. Add a vector database to the existing Postgres database. Since Corsair caches all emails that come through it, you can search locally instead of using the Gmail API. This allows lightning-fast search across the entire email and calendar in under 1 second

---

## Before Starting

Watch the setup videos in order:

1. `corsair-setup`
2. `corsair-webhooks`
3. `corsair-calendar-webhooks`

### Resources

- Corsair Setup Videos
- GitHub Repo

### Social Media Posts

Start by posting about what you are going to build on LinkedIn and X/Twitter.

1. Tag ChaiCode, Hitesh Sir, Piyush and Corsair
2. Corsair LinkedIn

**Add this line at the end of your post:**

`"Builder Mode On | MacBook Giveaway Hackathon"`

**Use hashtags:** #chaicode #corsair-dev

### Rules & Guidelines

- Build a Superhuman-style Gmail and Google Calendar workflow app using Next.js, Postgres and Corsair.
  - Gmail integration through Corsair is mandatory.
  - Google Calendar integration through Corsair is mandatory.
  - Ngrok is optional and can be used for webhook testing.

### Things to Submit

- Code must be open source on GitHub.
- Deployed live link is mandatory.
- Demo video is mandatory.
- Video should be YC-style: explain the problem, your solution, product demo, tech stack, Corsair usage, Gmail integration, Calendar integration and what makes your workflow better.

### Keep in Mind

- Hardcoded Gmail or Calendar data will not be accepted.
- A basic Gmail UI clone will not be enough to win.
- Your project must include at least one meaningful workflow improvement for Gmail or Google Calendar.
- AI should improve the workflow, not be added just for the sake of it.
- Bonus points for Corsair MCP agent chat, realtime webhooks, keyboard shortcuts, command palette, priority filtering, Corsair search API usage and fast local search.
- Plagiarized, copied or template-only submissions can be disqualified.
- Final submission must include GitHub repo, live link, demo video, X/Twitter post link, LinkedIn post link, short README, list of Corsair features used and bonus tasks attempted.

## Point Distribution

- Corsair Integration - 20 Points
- Gmail Workflow - 15 Points
- Calendar Workflow - 15 Points
- Productivity UX - 15 Points
- AI and MCP Usage - 15 Points
- Engineering Quality - 10 Points
- Demo and Documentation - 10 Points

## FAQ

### What do we need to build?

You need to build a Superhuman-style Gmail and Google Calendar workflow app using Next.js, Postgres and Corsair.

The goal is to make email and calendar workflows faster, simpler and more intuitive than the default Gmail and Google Calendar experience.

### Is Corsair mandatory?

Yes. Corsair is mandatory for Gmail and Google Calendar integrations.

### Is Gmail integration mandatory?

Yes. Gmail integration through Corsair is mandatory.

### Is Google Calendar integration mandatory?

Yes. Google Calendar integration through Corsair is mandatory.

### What tech stack should we use?

You must use:

- Next.js
- Postgres
- Corsair

Ngrok is optional and can be used for webhook testing.

### Can we use AI in the project?

Yes, but AI should improve the workflow. Do not add AI just for the sake of adding AI.

Good AI use cases include email priority filtering, smart drafting, calendar scheduling, agent chat using Corsair MCP, or better search.

### What is the highest-value bonus task?

The highest-value bonus task is adding agent chat using Corsair MCP.

Example:

`"Send a calendar invite to dev@corsair.dev at 9 AM next Thursday. Send him an email too saying I look forward to our meeting."`

### Can we build only a Gmail clone?

No. A basic Gmail UI clone will not be enough to win.

Your project should improve the workflow in some meaningful way, such as faster search, keyboard shortcuts, command palette, email-to-calendar flow, priority inbox, smart filtering, or agent-powered actions.

### Can we use hardcoded Gmail or Calendar data?

No. Hardcoded or fake Gmail/Calendar data will not be accepted.

Your project must use real integrations through Corsair.

### Do we need to deploy the project?

Yes. A deployed live link is mandatory.

### Is GitHub repo required?

Yes. Code must be open source on GitHub.

### Is demo video required?

Yes. A demo video is mandatory.

The video should explain the problem, your solution, product demo, tech stack, Corsair usage, Gmail integration, Calendar integration and what makes your workflow better.

### Do we need to post on LinkedIn and X/Twitter?

Yes. Start by posting about what you are going to build on LinkedIn and X/Twitter.

Tag ChaiCode, Hitesh Sir, Piyush and Corsair.

Add this line at the end of your post: "Builder Mode On | MacBook Giveaway Hackathon"

Use hashtags: #chaicode #corsair-dev

### Can we use external libraries?

Yes, you can use external libraries, but the core Gmail and Google Calendar integrations must happen through Corsair.

### What can lead to disqualification?

Submissions can be disqualified if they are plagiarized, copied, template-only, hardcoded, not deployed, missing GitHub repo, or not using Corsair properly.
