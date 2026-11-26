# Agents

Long-running helpers an app user starts from this app, each in its own folder:

```
app/agents/
  <name>/
    index.ts              export default defineAgent({ name: "<name>", output?: z.object(...), ... }) from ~stencil/agents
    skills/
      <topic>/SKILL.md    knowledge the agent reads before it works (written by the Chat Agent)
```

The folder name is the agent's `name`. The deploy registers every definition here for the
App preview and the Published app; nothing else reads this folder. A route starts one with
`createAgents(env).run("<name>", { message, files, input, onBehalfOf })`, talks to it with
`send` / `answer`, and the page follows it with `<AgentRunView>`. Load the `app-agents` skill
before adding one.
