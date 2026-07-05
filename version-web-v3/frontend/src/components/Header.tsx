import { RefObject } from 'react';

interface SessionSummary { id: number; title: string; display_title?: string; created_at: string; updated_at: string; msg_count: number }
interface ItinerarySummary { id: number; user_text: string; created_at: string; stop_count: number }

export default function Header({
  tab, sessionTitle, prefs,
  showSessions, sessions, loadSession, newSession, setShowSessions, sessRef,
  showPrefs, setShowPrefs, setPrefs, savePrefs, prefsRef,
  showSettings, setShowSettings, settings, setSettings, saveSettings, settingsRef,
  showModels, models, currentModel, modelSwitching, switchModel, setShowModels, modelRef,
  showItinSwitch, itineraries, currentItineraryId, switchItinerary, setShowItinSwitch, itinSwitcher,
}: {
  tab: string; sessionTitle: string; prefs: { mobility: string; interests: string; budget_level: string; budget_min_hkd: string; budget_max_hkd: string; home_base: string };
  showSessions: boolean; sessions: SessionSummary[]; loadSession: (id: number) => void; newSession: () => void; setShowSessions: (v: boolean) => void; sessRef: RefObject<HTMLDivElement | null>;
  showPrefs: boolean; setShowPrefs: (v: boolean) => void; setPrefs: (v: any) => void; savePrefs: () => void; prefsRef: RefObject<HTMLDivElement | null>;
  showSettings: boolean; setShowSettings: (v: boolean) => void; settings: any; setSettings: (v: any) => void; saveSettings: () => void; settingsRef: RefObject<HTMLDivElement | null>;
  showModels: boolean; models: string[]; currentModel: string; modelSwitching: boolean; switchModel: (m: string) => void; setShowModels: (v: boolean) => void; modelRef: RefObject<HTMLDivElement | null>;
  showItinSwitch: boolean; itineraries: ItinerarySummary[]; currentItineraryId?: number; switchItinerary: (id: number) => void; setShowItinSwitch: (v: boolean) => void; itinSwitcher: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="header">
      <div className="header-left">
        <h1>{sessionTitle || 'Inclusive Tourism'}</h1>
        {(prefs.mobility || prefs.interests || prefs.budget_level || prefs.home_base) && (
          <div className="pref-badges">
            {prefs.mobility && <span className="pref-badge">♿ {prefs.mobility}</span>}
            {prefs.budget_level && <span className="pref-badge">💰 {prefs.budget_level}</span>}
            {prefs.home_base && <span className="pref-badge">📍 {prefs.home_base}</span>}
            {prefs.interests && <span className="pref-badge">🏷 {prefs.interests.slice(0, 20)}{prefs.interests.length > 20 ? '…' : ''}</span>}
          </div>
        )}
      </div>
      <div className="header-buttons">
        {tab === 'chat' && (
          <>
            <div ref={sessRef} className="dropdown-container">
              <button className="hdr-btn" aria-label="Sessions" aria-expanded={showSessions} aria-haspopup="listbox" onClick={() => setShowSessions(!showSessions)}>
                Sessions ▾
              </button>
              {showSessions && (
                <div className="dropdown-menu dropdown-right" role="listbox" aria-label="Past sessions">
                  {sessions.length === 0 && <div className="dropdown-empty">No past sessions</div>}
                  {sessions.map(s => (
                    <div key={s.id} className="dropdown-item" role="option" tabIndex={-1} onClick={() => loadSession(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSession(s.id); } }}>
                      <div className="dropdown-item-title">{s.display_title || s.title}</div>
                      <div className="dropdown-item-sub">{Math.ceil(s.msg_count / 2)} conv · {new Date(s.updated_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="hdr-btn" aria-label="New session" onClick={newSession}>New</button>
            <div ref={prefsRef} className="dropdown-container">
              <button className="hdr-btn-sm" aria-label="Preferences" aria-expanded={showPrefs} aria-haspopup="dialog" onClick={() => setShowPrefs(!showPrefs)}>
                {Object.values(prefs).some(v => v) ? '★' : ''} Prefs
              </button>
              {showPrefs && (
                <div className="dropdown-panel">
                  <div className="dropdown-panel-title">My Preferences</div>
                  <div className="field-label">Mobility Needs</div>
                  <div className="pill-group">
                    {[
                      { v: 'wheelchair', l: '♿ Wheelchair' }, { v: 'cane', l: '🦯 Walking cane' },
                      { v: 'elderly', l: '👴 Elderly' }, { v: 'with_kids', l: '👶 With kids' },
                      { v: 'pregnant', l: '🤰 Pregnant' }, { v: 'slow', l: '🐢 Slow walker' },
                      { v: 'hearing_impaired', l: '👂 Hearing' }, { v: 'visually_impaired', l: '👁 Visual' },
                      { v: 'other_needs', l: '♿ Other needs' }, { v: 'none', l: 'None' },
                    ].map(({ v, l }) => (
                      <button key={v} className={`pill-btn ${prefs.mobility === (v === 'none' ? '' : v) ? 'pill-active' : ''}`} onClick={() => setPrefs((x: any) => ({ ...x, mobility: v === 'none' ? '' : v }))}>{l}</button>
                    ))}
                  </div>
                  <div className="field-label">Interests</div>
                  <div className="pill-group">
                    {['museum', 'cafe', 'park', 'temple', 'shopping_mall', 'viewpoint', 'market', 'art_gallery', 'historic_site', 'hotel'].map(cat => {
                      const sel = prefs.interests.includes(cat);
                      return <button key={cat} className={`pill-round ${sel ? 'pill-active' : ''}`} onClick={() => setPrefs((x: any) => ({
                        ...x, interests: sel ? x.interests.split(',').map((s: string) => s.trim()).filter((s: string) => s !== cat).join(', ') : (x.interests + ', ' + cat).replace(/^, /, '')
                      }))}>{cat.replace(/_/g, ' ')}</button>;
                    })}
                  </div>
                  <input className="field-input" placeholder="Any interests (comma separated)" value={prefs.interests} onChange={e => setPrefs((x: any) => ({ ...x, interests: e.target.value }))} />
                  <select className="field-input" value={prefs.budget_level} onChange={e => setPrefs((x: any) => ({ ...x, budget_level: e.target.value }))}>
                    <option value="">Budget level…</option><option value="cheap">💰 Cheap</option><option value="moderate">💰💰 Moderate</option><option value="expensive">💰💰💰 Expensive</option>
                  </select>
                  <input className="field-input" type="number" placeholder="Min daily budget HKD" value={prefs.budget_min_hkd || ''} onChange={e => setPrefs((x: any) => ({ ...x, budget_min_hkd: e.target.value ? Number(e.target.value) : '' }))} />
                  <input className="field-input" type="number" placeholder="Max daily budget HKD" value={prefs.budget_max_hkd || ''} onChange={e => setPrefs((x: any) => ({ ...x, budget_max_hkd: e.target.value ? Number(e.target.value) : '' }))} />
                  <input className="field-input" placeholder="Home base / hotel area" value={prefs.home_base} onChange={e => setPrefs((x: any) => ({ ...x, home_base: e.target.value }))} />
                  <div className="panel-actions">
                    <button className="btn-secondary" onClick={() => setShowPrefs(false)}>Cancel</button>
                    <button className="btn-primary" onClick={savePrefs}>Save</button>
                  </div>
                </div>
              )}
            </div>
            <div ref={settingsRef} className="dropdown-container">
              <button className="hdr-btn-sm" aria-label="Settings" aria-expanded={showSettings} aria-haspopup="dialog" onClick={() => setShowSettings(!showSettings)}>⚙</button>
              {showSettings && (
                <div className="dropdown-panel">
                  <div className="dropdown-panel-title">LLM Settings</div>
                  <div className="field-label">Provider</div>
                  <select className="field-input" value={settings.provider} onChange={e => setSettings((x: any) => ({ ...x, provider: e.target.value }))}>
                    <option value="gemini">Gemini API</option>
                    <option value="vertex">Vertex AI</option>
                    <option value="local">Local (llama.cpp)</option>
                    <option value="custom">Custom API</option>
                  </select>
                  <div className="field-label">Model</div>
                  <input className="field-input" value={settings.model} onChange={e => setSettings((x: any) => ({ ...x, model: e.target.value }))} placeholder="e.g. gemini-2.0-flash-001" />
                  {settings.provider === 'custom' && (
                    <>
                      <div className="field-label">Custom API URL</div>
                      <input className="field-input" value={settings.customApiUrl} onChange={e => setSettings((x: any) => ({ ...x, customApiUrl: e.target.value }))} placeholder="http://localhost:8080/v1/chat/completions" />
                      <div className="field-label">Custom API Key</div>
                      <input className="field-input" type="password" value={settings.customApiKey} onChange={e => setSettings((x: any) => ({ ...x, customApiKey: e.target.value }))} placeholder="sk-..." />
                    </>
                  )}
                  <div className="panel-actions">
                    <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                    <button className="btn-primary" onClick={saveSettings}>Save</button>
                  </div>
                </div>
              )}
            </div>
            <div ref={modelRef} className="dropdown-container">
              <button className="hdr-btn-sm" aria-label="Select model" aria-expanded={showModels} aria-haspopup="listbox" onClick={() => setShowModels(!showModels)} disabled={modelSwitching}>
                {modelSwitching ? '⟳' : '⚙'} {currentModel ? currentModel.replace(/\.gguf$/, '').slice(0, 20) : 'Model'}
              </button>
              {showModels && (
                <div className="dropdown-menu dropdown-right" role="listbox" aria-label="Available models">
                  {models.length === 0 && <div className="dropdown-empty">No models found</div>}
                  {models.map(m => (
                    <div key={m} className="dropdown-item" role="option" aria-selected={m === currentModel} tabIndex={-1} onClick={() => switchModel(m)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchModel(m); } }}>
                      <div className="dropdown-item-title">{m.replace(/\.gguf$/, '')}</div>
                      <div className="dropdown-item-sub">{m.endsWith('.gguf') ? 'Local GGUF' : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {tab === 'itinerary' && (
          <div ref={itinSwitcher} className="dropdown-container">
            <button className="hdr-btn" aria-label="Switch itinerary" aria-expanded={showItinSwitch} aria-haspopup="listbox" onClick={() => setShowItinSwitch(!showItinSwitch)}>
              {currentItineraryId ? `Iten #${currentItineraryId} ▾` : 'Itineraries ▾'}
            </button>
            {showItinSwitch && (
              <div className="dropdown-menu dropdown-right" role="listbox" aria-label="Saved itineraries">
                {itineraries.length === 0 && <div className="dropdown-empty">No itineraries</div>}
                {itineraries.map(i => (
                  <div key={i.id} className={`dropdown-item ${i.id === currentItineraryId ? 'dropdown-item-sel' : ''}`} role="option" aria-selected={i.id === currentItineraryId} tabIndex={-1} onClick={() => switchItinerary(i.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchItinerary(i.id); } }}>
                    <div className="dropdown-item-title">Itinerary #{i.id}</div>
                    <div className="dropdown-item-sub">{i.user_text?.slice(0, 40) || 'No description'} · {i.stop_count} stops</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
