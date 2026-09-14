import { spawn } from "node:child_process"
import { Plugin } from "@opencode/plugin/tui"

interface TuicrResult {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
}

function runTuicr(directory: string): Promise<TuicrResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("tuicr", ["--working-tree", "--stdout"], {
      cwd: directory,
      stdio: ["inherit", "pipe", "inherit"],
    })

    let stdout = ""
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.once("error", reject)
    child.once("close", (code, signal) => resolve({ code, signal, stdout }))
  })
}

export default Plugin.define({
  id: "tuicr",
  setup(context) {
    let running = false

    return context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
          id: "tuicr.review",
          title: "Review working tree with tuicr",
          description: "Collect review feedback and queue it in the active session",
          group: "Review",
          palette: true,
          slash: { name: "tuicr" },
          run: async () => {
            if (running) {
              context.ui.toast.show({
                title: "tuicr",
                message: "A review is already open",
                variant: "warning",
              })
              return
            }

            const route = context.ui.router.current()
            if (route.type !== "session") {
              context.ui.toast.show({
                title: "tuicr",
                message: "Open a session before starting a review",
                variant: "warning",
              })
              return
            }

            const directory = (context.location ?? context.data.location.default()).directory
            running = true

            try {
              context.renderer.suspend()

              let result: TuicrResult
              try {
                result = await runTuicr(directory)
              } finally {
                context.renderer.resume()
              }

              if (result.code !== 0) {
                const reason = result.signal ? `signal ${result.signal}` : `exit code ${result.code}`
                throw new Error(`tuicr exited with ${reason}`)
              }

              if (!result.stdout.trim()) {
                context.ui.toast.show({
                  title: "tuicr",
                  message: "Review closed without exported feedback",
                  variant: "info",
                })
                return
              }

              await context.client.session.prompt({
                sessionID: route.sessionID,
                text: result.stdout,
                delivery: "queue",
              })

              context.ui.toast.show({
                title: "tuicr",
                message: "Review feedback queued",
                variant: "success",
              })
            } catch (error) {
              context.ui.toast.show({
                title: "tuicr",
                message: error instanceof Error ? error.message : "Failed to run tuicr",
                variant: "error",
              })
            } finally {
              running = false
            }
          },
          }],
        }))

        return null
      },
    })
  },
})
