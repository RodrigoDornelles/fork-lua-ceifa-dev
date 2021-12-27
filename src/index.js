import { editor, KeyMod, KeyCode } from 'monaco-editor'
import defaultScript from './default.lua'

const monacoEditor = editor.create(document.getElementById('editor'), {
    language: 'lua',
    theme: 'vs-dark',
    automaticLayout: true,
    fontLigatures: true,
    fontFamily: 'Cascadia Code'
});

(async () => {
    if (window.pasteFetch) {
        try {
            const res = await window.pasteFetch
            if (res.ok) {
                monacoEditor.setValue(await res.text())
            }
        } catch (err) {
            console.error(err)
        }
    }

    if (!monacoEditor.getValue()) {
        monacoEditor.setValue(defaultScript)
    }

    const outputEl = document.getElementById('output')

    let runner, isRunning = false
    const getRunner = () => {
        if (runner && isRunning) {
            runner.terminate()
            runner = undefined
        }

        if (!runner) {
            runner = new Worker(new URL('./runner.js', import.meta.url))
        }

        isRunning = true

        runner.onmessage = ({ data: log }) => {
            document.getElementById('running')?.remove()

            if (typeof log === 'object') {
                outputEl.style.color = '#FFFFFF'
                isRunning = false
                return
            }

            const logEl = document.createElement('span')
            logEl.innerText = log
            outputEl.appendChild(logEl)
            outputEl.appendChild(document.createElement('br'))
        }

        return runner
    }

    const runLua = async () => {
        outputEl.style.color = '#888888'
        outputEl.innerHTML = '<span id="running">Running...</span>'

        getRunner().postMessage(monacoEditor.getValue())
    }

    await runLua()

    monacoEditor.addAction({
        id: 'execute-action',
        label: 'Execute code',
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyE],
        run: runLua
    })

    monacoEditor.addAction({
        id: 'save-action',
        label: 'Save code',
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyS],
        run: async (editor) => {
            try {
                document.getElementById('current-action').innerText = 'Saving...'

                const res = await fetch('https://api.ceifa.tv/documents', {
                    method: 'POST',
                    body: monacoEditor.getValue()
                })
    
                if (res.ok) {
                    const body = await res.json()
                    history.pushState(body, document.title, `?paste=${body.key}`)
                }

                // copy to clipboard
                await navigator.clipboard.writeText(location.href)

                document.getElementById('current-action').innerText = 'Copied to clipboard'
            } finally {
                setTimeout(() => {
                    document.getElementById('current-action').innerText = ''
                }, 3000)
            }
        }
    })
})()