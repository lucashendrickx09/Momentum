import { useState } from 'react'
import { useStore } from '../../store/store'
import { Card, SectionHeader, Field, TextInput, Select, TextArea, Empty } from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'
import { sum, fmtNum } from '../../lib/stats'
import { todayKey } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import type { GameProject, ProjectStage } from '../../store/types'

const STAGES: { id: ProjectStage; label: string; icon: string }[] = [
  { id: 'idea', label: 'Idea', icon: '💡' },
  { id: 'building', label: 'Building', icon: '🔨' },
  { id: 'shipped', label: 'Shipped', icon: '🚀' },
  { id: 'monetizing', label: 'Monetizing', icon: '💰' },
]
const STAGE_ORDER: ProjectStage[] = ['idea', 'building', 'shipped', 'monetizing']

export function ProjectsTab() {
  const projects = useStore((s) => s.financial.projects)
  const addProject = useStore((s) => s.addProject)
  const [open, setOpen] = useState(false)
  const [logFor, setLogFor] = useState<GameProject | null>(null)

  const totalHours = sum(projects.flatMap((p) => p.hours.map((h) => h.hours)))

  return (
    <>
      <Card accent={ACCENT.financial}>
        <SectionHeader
          title="Game pipeline"
          sub={`${projects.length} projects · ${fmtNum(totalHours)} hours logged`}
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Project
            </button>
          }
        />
        {projects.length === 0 ? (
          <Empty icon="🎮" title="No projects yet" sub="Add an idea and move it down the pipeline as it grows." />
        ) : (
          <div className="kanban">
            {STAGES.map((st) => {
              const inStage = projects.filter((p) => p.stage === st.id)
              if (inStage.length === 0) return null
              return (
                <div key={st.id}>
                  <div className="col-head">
                    <span>{st.icon}</span> {st.label} · {inStage.length}
                  </div>
                  <div className="stack" style={{ gap: 10 }}>
                    {inStage.map((p) => (
                      <ProjectCard key={p.id} project={p} onLog={() => setLogFor(p)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <ProjectForm open={open} onClose={() => setOpen(false)} onSave={addProject} />
      <HoursForm project={logFor} onClose={() => setLogFor(null)} />
    </>
  )
}

function ProjectCard({ project, onLog }: { project: GameProject; onLog: () => void }) {
  const updateProject = useStore((s) => s.updateProject)
  const removeProject = useStore((s) => s.removeProject)
  const hours = sum(project.hours.map((h) => h.hours))
  const idx = STAGE_ORDER.indexOf(project.stage)

  return (
    <div className="proj">
      <div className="row">
        <div className="grow">
          <div className="t" style={{ fontWeight: 700 }}>
            {project.name}
          </div>
          {project.notes && <div className="s dim">{project.notes}</div>}
        </div>
        <span className="tag">{fmtNum(hours)}h</span>
      </div>
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button
          className="btn sm ghost"
          disabled={idx <= 0}
          onClick={() => updateProject(project.id, { stage: STAGE_ORDER[idx - 1] })}
        >
          ‹
        </button>
        <button
          className="btn sm subtle"
          style={{ ['--accent' as string]: ACCENT.financial }}
          disabled={idx >= STAGE_ORDER.length - 1}
          onClick={() => updateProject(project.id, { stage: STAGE_ORDER[idx + 1] })}
        >
          Advance ›
        </button>
        <span className="right" />
        <button className="btn sm ghost" onClick={onLog}>
          + Hours
        </button>
        <button
          className="linkbtn danger"
          onClick={() => {
            if (confirm(`Delete project “${project.name}”?`)) removeProject(project.id)
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function ProjectForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (name: string, stage: ProjectStage, notes?: string) => void
}) {
  const [name, setName] = useState('')
  const [stage, setStage] = useState<ProjectStage>('idea')
  const [notes, setNotes] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="New game project">
      <div className="stack">
        <Field label="Project name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Working title" autoFocus />
        </Field>
        <Field label="Stage">
          <Select value={stage} onChange={(e) => setStage(e.target.value as ProjectStage)}>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes (optional)">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Concept, scope, platform…" />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            if (!name.trim()) return
            onSave(name.trim(), stage, notes.trim() || undefined)
            setName('')
            setNotes('')
            setStage('idea')
            onClose()
          }}
        >
          Add project
        </button>
      </div>
    </Modal>
  )
}

function HoursForm({ project, onClose }: { project: GameProject | null; onClose: () => void }) {
  const logProjectHours = useStore((s) => s.logProjectHours)
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={!!project} onClose={onClose} title={project ? `Log hours · ${project.name}` : ''}>
      <div className="stack">
        <Field label="Hours">
          <TextInput
            type="number"
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 1.5"
            autoFocus
          />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="What did you work on? (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            const h = parseFloat(hours)
            if (!project || !Number.isFinite(h) || h <= 0) return
            logProjectHours(project.id, date, h, note.trim() || undefined)
            setHours('')
            setNote('')
            setDate(todayKey())
            onClose()
          }}
        >
          Log hours
        </button>
      </div>
    </Modal>
  )
}
