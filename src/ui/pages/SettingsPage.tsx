import { useState } from 'react'
import { useApp } from '@/ui/useApp'

export const SettingsPage = () => {
  const { actions } = useApp()
  const [message, setMessage] = useState('')

  const handleExport = async () => {
    const payload = await actions.exportSave()
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cricket-gm-save.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Exported save successfully.')
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const raw = await file.text()
    try {
      await actions.importSave(raw)
      setMessage('Import completed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.')
    }
  }

  return (
    <>
      <header className="pageHeader">
        <h1 className="pageTitle">Settings</h1>
        <p className="pageMeta">Save management and project disclaimer.</p>
      </header>

      <section className="panel">
        <div className="panelBody">
          <p className="muted">This project only generates fictional players and teams.</p>
          <p className="legal">No affiliation with IPL franchises or real players.</p>
          <div className="actions">
            <button className="btnSecondary" onClick={() => void handleExport()}>
              Export Save
            </button>
            <label className="fileInput btnGhost">
              Import Save
              <input type="file" accept="application/json" onChange={handleImport} />
            </label>
          </div>
          {message && <p className="chip chipInfo">{message}</p>}
        </div>
      </section>
    </>
  )
}
