// Notes module — rich text editor with Quick Save / Save As / Open / Erase
let notesDirty = false

export function isNotesDirty() {
  return notesDirty
}

export function markNotesClean() {
  notesDirty = false
}

export function initNotesEditor() {
  const editor = document.getElementById('notes-editor')
  if (!editor) return

  editor.addEventListener('input', () => {
    notesDirty = true
  })

  // Toolbar formatting buttons
  document.querySelectorAll('.notes-tool-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null)
      editor.focus()
    })
  })

  // Font size dropdown
  document.getElementById('notes-font-size')?.addEventListener('change', e => {
    document.execCommand('fontSize', false, e.target.value)
    editor.focus()
  })

  // Heading dropdown
  document.getElementById('notes-heading')?.addEventListener('change', e => {
    const tag = e.target.value
    if (tag) {
      document.execCommand('formatBlock', false, tag)
    } else {
      document.execCommand('formatBlock', false, 'P')
    }
    editor.focus()
  })

  // Quick Save
  document.getElementById('notes-quick-save-btn')?.addEventListener('click', quickSave)

  // Save As
  document.getElementById('notes-save-as-btn')?.addEventListener('click', saveAs)

  // Open File
  document.getElementById('notes-open-btn')?.addEventListener('click', toggleFileList)

  // File list selection
  document.getElementById('notes-file-list')?.addEventListener('change', openSelectedFile)

  // Erase
  document.getElementById('notes-erase-btn')?.addEventListener('click', eraseEditor)

  // Auto-load TEMP_text/note.txt on startup
  autoLoadTempNote()
}

async function autoLoadTempNote() {
  try {
    const content = await window.electronAPI?.readNote('TEMP_text', 'note.txt')
    if (content) {
      document.getElementById('notes-editor').innerHTML = content
      notesDirty = false
      setStatus('Loaded previous session note.')
    }
  } catch { /* first run, no file */ }
}

async function quickSave() {
  const editor = document.getElementById('notes-editor')
  const content = editor.innerHTML
  const result = await window.electronAPI?.writeNote('TEMP_text', 'note.txt', content)
  if (result?.ok) {
    notesDirty = false
    setStatus('Quick saved.')
  } else {
    setStatus('Quick save failed.')
  }
}

async function saveAs() {
  const nameInput = document.getElementById('notes-save-as-name')
  const baseName = nameInput.value.trim()
  if (!baseName) {
    setStatus('Enter a file name first.')
    return
  }
  const now = new Date()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const yy = String(now.getFullYear()).slice(-2)
  const filename = `${baseName}_${m}_${d}_${yy}.txt`

  const editor = document.getElementById('notes-editor')
  const result = await window.electronAPI?.writeNote('UserSavedFiles', filename, editor.innerHTML)
  if (result?.ok) {
    notesDirty = false
    nameInput.value = ''
    setStatus(`Saved as ${filename}`)
  } else {
    setStatus(result?.error || 'Save failed.')
  }
}

async function toggleFileList() {
  const select = document.getElementById('notes-file-list')
  select.classList.toggle('hidden')
  if (!select.classList.contains('hidden')) {
    const files = await window.electronAPI?.listNotes('UserSavedFiles') || []
    select.innerHTML = '<option value="">Select a file...</option>'
    for (const f of files) {
      const opt = document.createElement('option')
      opt.value = f
      opt.textContent = f
      select.appendChild(opt)
    }
  }
}

async function openSelectedFile() {
  const select = document.getElementById('notes-file-list')
  const name = select.value
  if (!name) return
  const content = await window.electronAPI?.readNote('UserSavedFiles', name)
  if (content !== null) {
    document.getElementById('notes-editor').innerHTML = content
    notesDirty = false
    select.classList.add('hidden')
    setStatus(`Opened ${name}`)
  } else {
    setStatus('Could not open file.')
  }
}

function eraseEditor() {
  document.getElementById('notes-editor').innerHTML = ''
  notesDirty = true
  setStatus('Editor cleared.')
}

export function appendToNotes(html) {
  const editor = document.getElementById('notes-editor')
  if (!editor) return
  editor.innerHTML += html
  notesDirty = true
  setStatus('Data appended to notes.')
}

function setStatus(msg) {
  const el = document.getElementById('notes-status')
  if (el) {
    el.textContent = msg
    clearTimeout(el._timer)
    el._timer = setTimeout(() => { el.textContent = '' }, 4000)
  }
}
