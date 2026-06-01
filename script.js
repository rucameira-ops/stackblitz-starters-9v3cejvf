// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = 'https://csaksbpniduoectfjdxy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KAP0T8BC_d6pNbn-E_DIgw_tGQEHFhT';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// STATE
// ============================================================
let currentView = 'dashboard';
let currentAudit = null;
let currentTask = null;

// ============================================================
// NAVIGATION
// ============================================================
function navigate(view, data = null) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navMap = {
    dashboard: 0, plan: 1, audits: 2, pbc: 3, findings: 4, library: 5, universe: 6, users: 7
  };
  const navItems = document.querySelectorAll('.nav-item');
  if (navMap[view] !== undefined) navItems[navMap[view]].classList.add('active');

  const titles = {
    dashboard: 'Dashboard', plan: 'Plano Anual', audits: 'Auditorias',
    pbc: 'PbC Requests', findings: 'Findings', library: 'Biblioteca de Tarefas',
    universe: 'Audit Universe', users: 'Utilizadores'
  };
  document.getElementById('topbar-ctx').innerHTML = `<strong>${titles[view] || view}</strong>`;

  const content = document.getElementById('main-content');
  content.innerHTML = `<div class="loading-screen"><i class="ti ti-loader-2 spin"></i><p>A carregar...</p></div>`;

  const views = {
    dashboard: renderDashboard,
    plan: renderPlan,
    audits: renderAudits,
    pbc: renderPbc,
    findings: renderFindings,
    library: renderLibrary,
    universe: renderUniverse,
    users: renderUsers
  };

  if (views[view]) views[view](data);
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard() {
  const [auditsRes, findingsRes, pbcRes, tasksRes] = await Promise.all([
    db.from('audits').select('*').not('status', 'eq', 'Completed').not('status', 'eq', 'Cancelled'),
    db.from('findings').select('*').not('status', 'eq', 'Closed'),
    db.from('pbc_requests').select('*').eq('status', 'Pending'),
    db.from('tasks').select('*').eq('result', 'Ineffective')
  ]);

  const audits = auditsRes.data || [];
  const findings = findingsRes.data || [];
  const pbcPending = pbcRes.data || [];
  const ineffective = tasksRes.data || [];

  const overdueFindings = findings.filter(f => f.due_date && new Date(f.due_date) < new Date());

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Visão geral do programa de auditoria</div>
      </div>
      <button class="btn btn-primary" onclick="showNewAuditModal()">
        <i class="ti ti-plus"></i> Nova Auditoria
      </button>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Auditorias Activas</div>
        <div class="stat-value blue">${audits.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Findings Abertos</div>
        <div class="stat-value red">${findings.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">PbC Pendentes</div>
        <div class="stat-value orange">${pbcPending.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Overdue Findings</div>
        <div class="stat-value red">${overdueFindings.length}</div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <div class="card-header-title"><i class="ti ti-clipboard-list"></i> Auditorias Activas</div>
          <button class="btn btn-sm" onclick="navigate('audits')">Ver todas</button>
        </div>
        ${audits.length === 0 ? `<div class="empty-state"><i class="ti ti-clipboard-list"></i><p>Sem auditorias activas</p></div>` :
          audits.map(a => `
            <div class="list-row" style="grid-template-columns:1fr 100px 90px" onclick="openAudit('${a.id}')">
              <div>
                <div class="row-title">${a.title}</div>
                <div class="row-sub">${a.period_start ? formatDate(a.period_start) : ''}</div>
              </div>
              <span class="badge ${statusBadge(a.status)}">${a.status}</span>
              <span class="badge badge-gray">${phaseBadge(a.status)}</span>
            </div>`).join('')}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-header-title"><i class="ti ti-alert-triangle"></i> Findings Recentes</div>
          <button class="btn btn-sm" onclick="navigate('findings')">Ver todos</button>
        </div>
        ${findings.length === 0 ? `<div class="empty-state"><i class="ti ti-alert-triangle"></i><p>Sem findings abertos</p></div>` :
          findings.slice(0, 5).map(f => `
            <div class="list-row" style="grid-template-columns:1fr 80px 90px">
              <div>
                <div class="row-title">${f.title}</div>
                <div class="row-sub ${f.due_date && new Date(f.due_date) < new Date() ? 'deadline overdue' : 'deadline'}">
                  <i class="ti ti-calendar"></i> ${f.due_date ? formatDate(f.due_date) : 'Sem deadline'}
                </div>
              </div>
              <span class="badge ${severityBadge(f.severity)}">${f.severity || '-'}</span>
              <span class="badge ${findingStatusBadge(f.status)}">${f.status}</span>
            </div>`).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// AUDITS LIST
// ============================================================
async function renderAudits() {
  const { data: audits } = await db.from('audits').select('*, audit_entities(name)').order('created_at', { ascending: false });

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Auditorias</div>
        <div class="page-sub">${(audits || []).length} auditoria(s) no total</div>
      </div>
      <button class="btn btn-primary" onclick="showNewAuditModal()">
        <i class="ti ti-plus"></i> Nova Auditoria
      </button>
    </div>
    <div class="card">
      <div class="list-header" style="grid-template-columns:1fr 140px 100px 90px 100px">
        <span>Auditoria</span><span>Entidade</span><span>Período</span><span>Estado</span><span>Fase</span>
      </div>
      ${(audits || []).length === 0 ?
        `<div class="empty-state"><i class="ti ti-clipboard-list"></i><p>Sem auditorias criadas</p></div>` :
        (audits || []).map(a => `
          <div class="list-row" style="grid-template-columns:1fr 140px 100px 90px 100px" onclick="openAudit('${a.id}')">
            <div>
              <div class="row-title">${a.title}</div>
              <div class="row-sub">${a.objective || ''}</div>
            </div>
            <div class="row-sub">${a.audit_entities?.name || '-'}</div>
            <div class="row-sub">${a.period_start ? formatDate(a.period_start) : '-'}</div>
            <span class="badge ${statusBadge(a.status)}">${a.status}</span>
            <span class="badge badge-gray">${a.status}</span>
          </div>`).join('')}
    </div>
  `;
}

// ============================================================
// OPEN AUDIT (programme view)
// ============================================================
async function openAudit(auditId) {
  const { data: audit } = await db.from('audits').select('*, audit_entities(name)').eq('id', auditId).single();
  const { data: tasks } = await db.from('tasks').select('*').eq('audit_id', auditId).order('order_index');
  currentAudit = audit;

  const phases = ['Opening', 'Fieldwork', 'Closing'];
  const tasksByPhase = {};
  phases.forEach(p => tasksByPhase[p] = (tasks || []).filter(t => t.phase === p));

  document.getElementById('topbar-ctx').innerHTML = `<strong>${audit.title}</strong>`;

  document.getElementById('main-content').innerHTML = `
    <div style="padding:20px 24px 0">
      <div class="breadcrumb">
        <a onclick="navigate('audits')">Auditorias</a>
        <i class="ti ti-chevron-right" style="font-size:12px"></i>
        <strong>${audit.title}</strong>
      </div>
      <div class="page-header">
        <div>
          <div class="page-title">${audit.title}</div>
          <div class="page-sub">${audit.audit_entities?.name || ''} · ${audit.period_start ? formatDate(audit.period_start) : ''} - ${audit.period_end ? formatDate(audit.period_end) : ''}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="showScopingModal('${audit.id}')"><i class="ti ti-file-text"></i> Scoping</button>
          <button class="btn btn-primary" onclick="showAddTaskModal('${audit.id}')"><i class="ti ti-plus"></i> Adicionar Tarefa</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin:0 24px">
      <div class="phase-tabs">
        ${phases.map((p, i) => `
          <div class="phase-tab ${i === 0 ? 'active' : ''}" onclick="switchPhase(this,'phase-${p}')">${p}
            <span class="badge badge-gray" style="margin-left:6px">${tasksByPhase[p].length}</span>
          </div>`).join('')}
      </div>

      ${phases.map((p, i) => `
        <div id="phase-${p}" style="display:${i === 0 ? 'block' : 'none'}">
          <div class="list-header" style="grid-template-columns:32px 1fr 130px 90px 100px">
            <span></span><span>Tarefa</span><span>Responsável</span><span>Resultado</span><span>Deadline</span>
          </div>
          ${tasksByPhase[p].length === 0 ?
            `<div class="empty-state"><i class="ti ti-list-check"></i><p>Sem tarefas nesta fase.
              <a onclick="showAddTaskModal('${audit.id}','${p}')">Adicionar tarefa</a></p></div>` :
            tasksByPhase[p].map((t, idx) => `
              <div class="list-row" style="grid-template-columns:32px 1fr 130px 90px 100px" onclick="openTask('${t.id}')">
                <div class="task-num">${idx + 1}</div>
                <div>
                  <div class="row-title">${t.title}</div>
                  <div class="row-sub">${t.description || ''}</div>
                </div>
                <div class="row-sub">-</div>
                <span class="badge ${resultBadge(t.result)}">${t.result || 'Not Started'}</span>
                <div class="deadline ${t.due_date && new Date(t.due_date) < new Date() ? 'overdue' : ''}">
                  ${t.due_date ? formatDate(t.due_date) : '-'}
                </div>
              </div>`).join('')}
        </div>`).join('')}
    </div>
  `;
}

// ============================================================
// OPEN TASK (detail view)
// ============================================================
async function openTask(taskId) {
  const { data: task } = await db.from('tasks').select('*').eq('id', taskId).single();
  const { data: comments } = await db.from('comments').select('*').eq('task_id', taskId).order('created_at');
  const { data: attachments } = await db.from('attachments').select('*').eq('task_id', taskId).order('created_at');
  const { data: trail } = await db.from('audit_trail').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
  const { data: finding } = await db.from('findings').select('*').eq('task_id', taskId).single();
  currentTask = task;

  document.getElementById('topbar-ctx').innerHTML = `<strong>${task.title}</strong>`;
  document.getElementById('main-content').innerHTML = `
    <div class="task-detail-layout">
      <div class="task-main">
        <div class="task-toolbar">
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="openAudit('${task.audit_id}')">
              <i class="ti ti-arrow-left"></i> Voltar
            </button>
            <span class="breadcrumb" style="margin:0">
              <a onclick="openAudit('${task.audit_id}')">Programa</a>
              <i class="ti ti-chevron-right" style="font-size:11px"></i>
              ${task.phase}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="result-toggle">
              <button id="btn-eff" onclick="setResult('${task.id}','Effective')"
                class="${task.result === 'Effective' ? 'active-eff' : ''}">
                <i class="ti ti-check"></i> Effective
              </button>
              <button id="btn-ineff" onclick="setResult('${task.id}','Ineffective')"
                class="${task.result === 'Ineffective' ? 'active-ineff' : ''}">
                <i class="ti ti-x"></i> Ineffective
              </button>
            </div>
            <button class="btn btn-sm btn-primary" onclick="saveTask('${task.id}')">
              <i class="ti ti-device-floppy"></i> Guardar
            </button>
          </div>
        </div>

        <div class="task-content">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:4px" 
              contenteditable="true" id="task-title">${task.title}</h2>
          <div style="font-size:12px;color:var(--muted);margin-bottom:24px">
            ${task.phase} · ${currentAudit?.title || ''}
          </div>

          <div class="task-section">
            <div class="task-section-title">Descrição & Objectivo</div>
            <div class="form-group">
              <label class="form-label">Descrição</label>
              <textarea class="form-control" id="task-description" rows="3">${task.description || ''}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Risco</label>
                <textarea class="form-control" id="task-risk" rows="2">${task.risk || ''}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Assertion</label>
                <select class="form-control" id="task-assertion">
                  <option value="">Seleccionar...</option>
                  ${['Completeness','Accuracy','Existence','Valuation','Rights & Obligations','Presentation'].map(a =>
                    `<option ${task.assertion === a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <div class="task-section">
            <div class="task-section-title">Procedimentos de Teste</div>
            <div class="form-group">
              <label class="form-label">Procedimentos</label>
              <textarea class="form-control" id="task-procedures" rows="4">${task.procedures || ''}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Test Approach</label>
                <select class="form-control" id="task-approach">
                  <option value="">Seleccionar...</option>
                  ${['Walkthrough','Inquiry','Observation','Reperformance','Analytics'].map(a =>
                    `<option ${task.test_approach === a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Sample Size</label>
                <input type="number" class="form-control" id="task-sample" value="${task.sample_size || ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Population</label>
                <input type="text" class="form-control" id="task-population" value="${task.population || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Sampling Methodology</label>
                <input type="text" class="form-control" id="task-sampling" value="${task.sampling_methodology || ''}">
              </div>
            </div>
          </div>

          <div class="task-section">
            <div class="task-section-title">Documentação</div>
            <div class="form-group">
              <label class="form-label">Document Request</label>
              <textarea class="form-control" id="task-docreq" rows="2">${task.document_request || ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Workpaper Link (SharePoint)</label>
              <div style="display:flex;gap:8px">
                <input type="url" class="form-control" id="task-wp" 
                  placeholder="https://bial.sharepoint.com/..." value="${task.workpaper_link || ''}">
                ${task.workpaper_link ?
                  `<a href="${task.workpaper_link}" target="_blank" class="btn btn-sm">
                    <i class="ti ti-external-link"></i> Abrir
                  </a>` : ''}
              </div>
            </div>
          </div>

          <div class="task-section">
            <div class="task-section-title">Resultados</div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-control" id="task-notes" rows="3">${task.notes || ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Results</label>
              <textarea class="form-control" id="task-results" rows="3">${task.results || ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Conclusion</label>
              <textarea class="form-control" id="task-conclusion" rows="3">${task.conclusion || ''}</textarea>
            </div>
          </div>

          <div id="finding-section" style="display:${task.result === 'Ineffective' ? 'block' : 'none'}">
            ${finding ? renderFindingBox(finding) : renderNewFindingBox(task.id, task.audit_id)}
          </div>
        </div>
      </div>

      <!-- SIDEBAR DIREITA -->
      <div class="task-sidebar-right">
        <div class="sidebar-tabs">
          <div class="sidebar-tab active" onclick="switchSideTab(this,'comments')">
            <i class="ti ti-message-circle"></i> Comentários
          </div>
          <div class="sidebar-tab" onclick="switchSideTab(this,'attachments')">
            <i class="ti ti-paperclip"></i> Ficheiros
          </div>
          <div class="sidebar-tab" onclick="switchSideTab(this,'trail')">
            <i class="ti ti-history"></i> Histórico
          </div>
        </div>
        <div class="sidebar-content">
          <div class="sidebar-section active" id="side-comments">
            <div class="comment-box">
              <textarea id="comment-input" placeholder="Adicionar comentário..."></textarea>
              <button class="btn btn-sm btn-primary" style="margin-top:6px;width:100%"
                onclick="addComment('${task.id}')">
                <i class="ti ti-send"></i> Enviar
              </button>
            </div>
            ${(comments || []).length === 0 ?
              `<div class="empty-state"><i class="ti ti-message-circle"></i><p>Sem comentários</p></div>` :
              (comments || []).map(c => `
                <div class="comment-item">
                  <div class="avatar">${initials(c.author_name)}</div>
                  <div class="comment-body">
                    <div class="comment-meta"><strong>${c.author_name}</strong> · ${formatDateTime(c.created_at)}</div>
                    <div class="comment-text">${c.content}</div>
                  </div>
                </div>`).join('')}
          </div>

          <div class="sidebar-section" id="side-attachments">
            <div style="margin-bottom:12px">
              <input type="file" id="file-input" style="display:none" onchange="uploadFile('${task.id}')">
              <button class="btn btn-sm btn-primary" style="width:100%"
                onclick="document.getElementById('file-input').click()">
                <i class="ti ti-upload"></i> Anexar Ficheiro
              </button>
            </div>
            ${(attachments || []).length === 0 ?
              `<div class="empty-state"><i class="ti ti-paperclip"></i><p>Sem ficheiros</p></div>` :
              (attachments || []).map(a => `
                <div class="attachment-item">
                  <i class="ti ti-file"></i>
                  <div>
                    <a href="${a.file_url}" target="_blank" style="font-size:12px;font-weight:500">${a.file_name}</a>
                    <small style="display:block;color:var(--muted)">${formatDate(a.created_at)}</small>
                  </div>
                </div>`).join('')}
          </div>

          <div class="sidebar-section" id="side-trail">
            ${(trail || []).length === 0 ?
              `<div class="empty-state"><i class="ti ti-history"></i><p>Sem histórico</p></div>` :
              (trail || []).map(t => `
                <div class="trail-item">
                  <div class="trail-dot"><i class="ti ti-edit"></i></div>
                  <div class="trail-body">
                    <div class="trail-meta"><strong>${t.user_name}</strong> · ${formatDateTime(t.created_at)}</div>
                    <div class="trail-text">${t.action}${t.detail ? ': ' + t.detail : ''}</div>
                  </div>
                </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// FINDINGS BOX
// ============================================================
function renderFindingBox(f) {
  return `
    <div class="finding-box">
      <div class="finding-box-title"><i class="ti ti-alert-triangle"></i> Finding Associado</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Título</label>
          <input class="form-control" id="f-title" value="${f.title || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Severidade</label>
          <select class="form-control" id="f-severity">
            ${['High','Medium','Low'].map(s => `<option ${f.severity===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="form-control" id="f-description" rows="3">${f.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Root Cause</label>
        <textarea class="form-control" id="f-rootcause" rows="2">${f.root_cause || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Plano de Acção</label>
        <textarea class="form-control" id="f-actionplan" rows="3">${f.action_plan || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-control" id="f-status">
            ${['Open','In Remediation','Pending Verification','Closed'].map(s =>
              `<option ${f.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input type="date" class="form-control" id="f-deadline" value="${f.due_date || ''}">
        </div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="saveFinding('${f.id}')">
        <i class="ti ti-device-floppy"></i> Guardar Finding
      </button>
    </div>`;
}

function renderNewFindingBox(taskId, auditId) {
  return `
    <div class="finding-box">
      <div class="finding-box-title"><i class="ti ti-alert-triangle"></i> Novo Finding</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Título</label>
          <input class="form-control" id="f-title" placeholder="Título do finding">
        </div>
        <div class="form-group">
          <label class="form-label">Severidade</label>
          <select class="form-control" id="f-severity">
            <option>High</option><option selected>Medium</option><option>Low</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="form-control" id="f-description" rows="3" placeholder="Descreve o finding..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Root Cause</label>
        <textarea class="form-control" id="f-rootcause" rows="2" placeholder="Causa raiz identificada..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Plano de Acção</label>
        <textarea class="form-control" id="f-actionplan" rows="3" placeholder="Acções de remediação acordadas..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-control" id="f-status">
            <option>Open</option><option>In Remediation</option>
            <option>Pending Verification</option><option>Closed</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input type="date" class="form-control" id="f-deadline">
        </div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="createFinding('${taskId}','${auditId}')">
        <i class="ti ti-plus"></i> Criar Finding
      </button>
    </div>`;
}

// ============================================================
// SAVE TASK
// ============================================================
async function saveTask(taskId) {
  const updates = {
    title: document.getElementById('task-title').textContent,
    description: document.getElementById('task-description').value,
    risk: document.getElementById('task-risk').value,
    assertion: document.getElementById('task-assertion').value,
    procedures: document.getElementById('task-procedures').value,
    test_approach: document.getElementById('task-approach').value,
    sample_size: parseInt(document.getElementById('task-sample').value) || null,
    population: document.getElementById('task-population').value,
    sampling_methodology: document.getElementById('task-sampling').value,
    document_request: document.getElementById('task-docreq').value,
    workpaper_link: document.getElementById('task-wp').value,
    notes: document.getElementById('task-notes').value,
    results: document.getElementById('task-results').value,
    conclusion: document.getElementById('task-conclusion').value,
  };
  await db.from('tasks').update(updates).eq('id', taskId);
  await addTrail(taskId, null, null, null, 'Rui Mateus', 'Tarefa actualizada', null);
  showToast('Guardado com sucesso');
}

// ============================================================
// SET RESULT
// ============================================================
async function setResult(taskId, result) {
  await db.from('tasks').update({ result }).eq('id', taskId);
  document.getElementById('btn-eff').className = result === 'Effective' ? 'active-eff' : '';
  document.getElementById('btn-ineff').className = result === 'Ineffective' ? 'active-ineff' : '';
  document.getElementById('finding-section').style.display = result === 'Ineffective' ? 'block' : 'none';
  await addTrail(taskId, null, null, null, 'Rui Mateus', `Resultado marcado como ${result}`, null);
}

// ============================================================
// CREATE / SAVE FINDING
// ============================================================
async function createFinding(taskId, auditId) {
  const { data } = await db.from('findings').insert({
    task_id: taskId, audit_id: auditId,
    title: document.getElementById('f-title').value,
    description: document.getElementById('f-description').value,
    root_cause: document.getElementById('f-rootcause').value,
    severity: document.getElementById('f-severity').value,
    action_plan: document.getElementById('f-actionplan').value,
    status: document.getElementById('f-status').value,
    due_date: document.getElementById('f-deadline').value || null,
  }).select().single();
  await addTrail(taskId, null, null, null, 'Rui Mateus', 'Finding criado', data?.title);
  showToast('Finding criado');
  openTask(taskId);
}

async function saveFinding(findingId) {
  await db.from('findings').update({
    title: document.getElementById('f-title').value,
    description: document.getElementById('f-description').value,
    root_cause: document.getElementById('f-rootcause').value,
    severity: document.getElementById('f-severity').value,
    action_plan: document.getElementById('f-actionplan').value,
    status: document.getElementById('f-status').value,
    due_date: document.getElementById('f-deadline').value || null,
  }).eq('id', findingId);
  showToast('Finding guardado');
}

// ============================================================
// COMMENT
// ============================================================
async function addComment(taskId) {
  const content = document.getElementById('comment-input').value.trim();
  if (!content) return;
  await db.from('comments').insert({ task_id: taskId, author_name: 'Rui Mateus', content });
  await addTrail(taskId, null, null, null, 'Rui Mateus', 'Comentário adicionado', null);
  openTask(taskId);
}

// ============================================================
// FILE UPLOAD
// ============================================================
async function uploadFile(taskId) {
  const file = document.getElementById('file-input').files[0];
  if (!file) return;
  const path = `tasks/${taskId}/${Date.now()}_${file.name}`;
  const { data, error } = await db.storage.from('audit-files').upload(path, file);
  if (error) { showToast('Erro no upload: ' + error.message, true); return; }
  const { data: urlData } = db.storage.from('audit-files').getPublicUrl(path);
  await db.from('attachments').insert({
    task_id: taskId, file_name: file.name,
    file_url: urlData.publicUrl, file_size: file.size, uploaded_by: 'Rui Mateus'
  });
  await addTrail(taskId, null, null, null, 'Rui Mateus', 'Ficheiro anexado', file.name);
  showToast('Ficheiro carregado');
  openTask(taskId);
}

// ============================================================
// AUDIT TRAIL
// ============================================================
async function addTrail(taskId, findingId, pbcId, auditId, userName, action, detail) {
  await db.from('audit_trail').insert({ task_id: taskId, finding_id: findingId, pbc_id: pbcId, audit_id: auditId, user_name: userName, action, detail });
}

// ============================================================
// FINDINGS PAGE
// ============================================================
async function renderFindings() {
  const { data: findings } = await db.from('findings')
    .select('*, audits(title)')
    .order('created_at', { ascending: false });

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Findings</div>
        <div class="page-sub">${(findings || []).length} finding(s) no total</div>
      </div>
    </div>
    <div class="card">
      <div class="list-header" style="grid-template-columns:1fr 120px 110px 110px 90px">
        <span>Finding</span><span>Auditoria</span><span>Deadline</span><span>Estado</span><span>Severidade</span>
      </div>
      ${(findings || []).length === 0 ?
        `<div class="empty-state"><i class="ti ti-alert-triangle"></i><p>Sem findings</p></div>` :
        (findings || []).map(f => `
          <div class="list-row" style="grid-template-columns:1fr 120px 110px 110px 90px">
            <div>
              <div class="row-title">${f.title}</div>
              <div class="row-sub">${f.description ? f.description.substring(0, 80) + '...' : ''}</div>
            </div>
            <div class="row-sub">${f.audits?.title || '-'}</div>
            <div class="deadline ${f.due_date && new Date(f.due_date) < new Date() ? 'overdue' : ''}">
              ${f.due_date ? formatDate(f.due_date) : '-'}
            </div>
            <span class="badge ${findingStatusBadge(f.status)}">${f.status}</span>
            <span class="badge ${severityBadge(f.severity)}">${f.severity || '-'}</span>
          </div>`).join('')}
    </div>`;
}

// ============================================================
// PBC PAGE
// ============================================================
async function renderPbc() {
  const { data: pbcs } = await db.from('pbc_requests')
    .select('*, audits(title), users(name)')
    .order('created_at', { ascending: false });

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">PbC Requests</div>
        <div class="page-sub">${(pbcs || []).length} pedido(s) no total</div>
      </div>
      <button class="btn btn-primary" onclick="showNewPbcModal()">
        <i class="ti ti-plus"></i> Novo Pedido
      </button>
    </div>
    <div class="card">
      <div class="list-header" style="grid-template-columns:1fr 130px 120px 100px 90px">
        <span>Pedido</span><span>Owner</span><span>Deadline</span><span>Auditoria</span><span>Estado</span>
      </div>
      ${(pbcs || []).length === 0 ?
        `<div class="empty-state"><i class="ti ti-file-upload"></i><p>Sem pedidos PbC</p></div>` :
        (pbcs || []).map(p => `
          <div class="list-row" style="grid-template-columns:1fr 130px 120px 100px 90px">
            <div>
              <div class="row-title">${p.title}</div>
              <div class="row-sub">${p.description || ''}</div>
            </div>
            <div class="row-sub">${p.users?.name || '-'}</div>
            <div class="deadline ${p.due_date && new Date(p.due_date) < new Date() ? 'overdue' : ''}">
              ${p.due_date ? formatDate(p.due_date) : '-'}
            </div>
            <div class="row-sub">${p.audits?.title || '-'}</div>
            <span class="badge ${pbcStatusBadge(p.status)}">${p.status}</span>
          </div>`).join('')}
    </div>`;
}

// ============================================================
// PLAN / UNIVERSE / LIBRARY / USERS (stubs funcionais)
// ============================================================
async function renderPlan() {
  const { data } = await db.from('audit_plan').select('*, audit_entities(name)').order('planned_start');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Plano Anual</div></div>
      <button class="btn btn-primary" onclick="showNewPlanModal()"><i class="ti ti-plus"></i> Adicionar</button>
    </div>
    <div class="card">
      <div class="list-header" style="grid-template-columns:1fr 140px 100px 100px 90px">
        <span>Auditoria</span><span>Entidade</span><span>Início</span><span>Fim</span><span>Estado</span>
      </div>
      ${(data || []).length === 0 ?
        `<div class="empty-state"><i class="ti ti-calendar"></i><p>Plano anual vazio</p></div>` :
        (data || []).map(p => `
          <div class="list-row" style="grid-template-columns:1fr 140px 100px 100px 90px">
            <div class="row-title">${p.audit_title}</div>
            <div class="row-sub">${p.audit_entities?.name || '-'}</div>
            <div class="row-sub">${p.planned_start ? formatDate(p.planned_start) : '-'}</div>
            <div class="row-sub">${p.planned_end ? formatDate(p.planned_end) : '-'}</div>
            <span class="badge ${statusBadge(p.status)}">${p.status}</span>
          </div>`).join('')}
    </div>`;
}

async function renderUniverse() {
  const { data } = await db.from('audit_entities').select('*').order('name');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Audit Universe</div></div>
      <button class="btn btn-primary" onclick="showNewEntityModal()"><i class="ti ti-plus"></i> Adicionar Entidade</button>
    </div>
    <div class="card">
      ${(data || []).map(e => `
        <div class="list-row" style="grid-template-columns:1fr 120px">
          <div>
            <div class="row-title">${e.name}</div>
            <div class="row-sub">${e.description || ''}</div>
          </div>
          <span class="badge badge-gray">${e.category || '-'}</span>
        </div>`).join('')}
    </div>`;
}

async function renderLibrary() {
  const { data } = await db.from('task_library').select('*, audit_entities(name)').order('phase');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Biblioteca de Tarefas</div></div>
      <button class="btn btn-primary" onclick="showNewLibraryTaskModal()"><i class="ti ti-plus"></i> Nova Tarefa</button>
    </div>
    <div class="card">
      ${(data || []).map(t => `
        <div class="list-row" style="grid-template-columns:80px 1fr 120px 80px">
          <span class="badge badge-gray">${t.phase}</span>
          <div>
            <div class="row-title">${t.title}</div>
            <div class="row-sub">${t.description ? t.description.substring(0,80)+'...' : ''}</div>
          </div>
          <div class="row-sub">${t.is_global ? 'Global' : (t.audit_entities?.name || '-')}</div>
          <button class="btn btn-sm btn-ghost" onclick="editLibraryTask('${t.id}')">
            <i class="ti ti-edit"></i>
          </button>
        </div>`).join('')}
    </div>`;
}

async function renderUsers() {
  const { data } = await db.from('users').select('*').order('name');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Utilizadores</div></div>
      <button class="btn btn-primary" onclick="showNewUserModal()"><i class="ti ti-plus"></i> Novo Utilizador</button>
    </div>
    <div class="card">
      ${(data || []).length === 0 ?
        `<div class="empty-state"><i class="ti ti-users"></i><p>Sem utilizadores criados</p></div>` :
        (data || []).map(u => `
          <div class="list-row" style="grid-template-columns:36px 1fr 100px 140px">
            <div class="avatar">${initials(u.name)}</div>
            <div>
              <div class="row-title">${u.name}</div>
              <div class="row-sub">${u.email}</div>
            </div>
            <span class="badge ${u.role === 'admin' ? 'badge-blue' : u.role === 'vp' ? 'badge-green' : 'badge-gray'}">${u.role}</span>
            <button class="btn btn-sm btn-ghost" onclick="deleteUser('${u.id}')">
              <i class="ti ti-trash"></i> Remover
            </button>
          </div>`).join('')}
    </div>`;
}

// ============================================================
// MODALS
// ============================================================
function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() {
  const m = document.getElementById('modal-overlay');
  if (m) m.remove();
}

async function showNewAuditModal() {
  const { data: entities } = await db.from('audit_entities').select('*').order('name');
  showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>Nova Auditoria</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Título *</label>
          <input class="form-control" id="m-title" placeholder="Ex: Auditoria T&E 2025">
        </div>
        <div class="form-group">
          <label class="form-label">Entidade</label>
          <select class="form-control" id="m-entity">
            <option value="">Seleccionar...</option>
            ${(entities || []).map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Objectivo</label>
          <textarea class="form-control" id="m-objective" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Âmbito</label>
          <textarea class="form-control" id="m-scope" rows="2"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Período - Início</label>
            <input type="date" class="form-control" id="m-pstart">
          </div>
          <div class="form-group">
            <label class="form-label">Período - Fim</label>
            <input type="date" class="form-control" id="m-pend">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="createAudit()">Criar Auditoria</button>
      </div>
    </div>`);
}

async function createAudit() {
  const title = document.getElementById('m-title').value.trim();
  if (!title) { showToast('Título obrigatório', true); return; }
  const { data } = await db.from('audits').insert({
    title,
    entity_id: document.getElementById('m-entity').value || null,
    objective: document.getElementById('m-objective').value,
    scope: document.getElementById('m-scope').value,
    period_start: document.getElementById('m-pstart').value || null,
    period_end: document.getElementById('m-pend').value || null,
    status: 'Planning'
  }).select().single();
  closeModal();
  showToast('Auditoria criada');
  if (data) await addTasksFromLibrary(data.id, data.entity_id);
  navigate('audits');
}

async function addTasksFromLibrary(auditId, entityId) {
  const { data: globalTasks } = await db.from('task_library')
    .select('*').eq('is_global', true);
  const { data: entityTasks } = entityId ?
    await db.from('task_library').select('*').eq('entity_id', entityId).eq('is_global', false) :
    { data: [] };
  const all = [...(globalTasks || []), ...(entityTasks || [])];
  if (all.length === 0) return;
  await db.from('tasks').insert(all.map((t, i) => ({
    audit_id: auditId, library_id: t.id, phase: t.phase,
    title: t.title, description: t.description, procedures: t.procedures,
    risk: t.risk, assertion: t.assertion, test_approach: t.test_approach,
    order_index: i, result: 'Not Started'
  })));
}

async function showAddTaskModal(auditId, phase = 'Fieldwork') {
  const { data: library } = await db.from('task_library').select('*').order('title');
  showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>Adicionar Tarefa</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Fase</label>
          <select class="form-control" id="m-phase">
            ${['Opening','Fieldwork','Closing'].map(p =>
              `<option ${p === phase ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Da biblioteca</label>
          <select class="form-control" id="m-lib" onchange="prefillFromLibrary(this)">
            <option value="">Tarefa nova (em branco)</option>
            ${(library || []).map(t => `<option value="${t.id}" data-title="${t.title}" 
              data-desc="${t.description||''}" data-proc="${t.procedures||''}" 
              data-risk="${t.risk||''}">${t.phase} · ${t.title}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Título *</label>
          <input class="form-control" id="m-title" placeholder="Título da tarefa">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-control" id="m-desc" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input type="date" class="form-control" id="m-due">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="addTask('${auditId}')">Adicionar</button>
      </div>
    </div>`);
}

function prefillFromLibrary(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  document.getElementById('m-title').value = opt.dataset.title || '';
  document.getElementById('m-desc').value = opt.dataset.desc || '';
}

async function addTask(auditId) {
  const title = document.getElementById('m-title').value.trim();
  if (!title) { showToast('Título obrigatório', true); return; }
  await db.from('tasks').insert({
    audit_id: auditId, phase: document.getElementById('m-phase').value,
    title, description: document.getElementById('m-desc').value,
    due_date: document.getElementById('m-due').value || null,
    result: 'Not Started', order_index: 99
  });
  closeModal();
  showToast('Tarefa adicionada');
  openAudit(auditId);
}

async function showNewUserModal() {
  showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>Novo Utilizador</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-control" id="m-name" placeholder="Nome completo">
        </div>
        <div class="form-group">
          <label class="form-label">Email Outlook *</label>
          <input type="email" class="form-control" id="m-email" placeholder="nome@bial.com">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Acesso</label>
          <select class="form-control" id="m-role">
            <option value="stakeholder">Stakeholder</option>
            <option value="vp">VP Auditoria</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="createUser()">Criar</button>
      </div>
    </div>`);
}

async function createUser() {
  const name = document.getElementById('m-name').value.trim();
  const email = document.getElementById('m-email').value.trim();
  if (!name || !email) { showToast('Nome e email obrigatórios', true); return; }
  const { error } = await db.from('users').insert({
    name, email, role: document.getElementById('m-role').value
  });
  if (error) { showToast('Erro: ' + error.message, true); return; }
  closeModal();
  showToast('Utilizador criado');
  renderUsers();
}

async function deleteUser(id) {
  if (!confirm('Remover utilizador?')) return;
  await db.from('users').delete().eq('id', id);
  showToast('Utilizador removido');
  renderUsers();
}

async function showNewPbcModal() {
  const [auditsRes, usersRes] = await Promise.all([
    db.from('audits').select('id,title').not('status','eq','Completed'),
    db.from('users').select('*').order('name')
  ]);
  showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>Novo PbC Request</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Título *</label>
          <input class="form-control" id="m-title" placeholder="Ex: Extracto de pagamentos Q1">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-control" id="m-desc" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Auditoria</label>
          <select class="form-control" id="m-audit">
            <option value="">Seleccionar...</option>
            ${(auditsRes.data || []).map(a => `<option value="${a.id}">${a.title}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Owner</label>
          <select class="form-control" id="m-owner">
            <option value="">Seleccionar...</option>
            ${(usersRes.data || []).map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input type="date" class="form-control" id="m-due">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="createPbc()">Criar Pedido</button>
      </div>
    </div>`);
}

async function createPbc() {
  const title = document.getElementById('m-title').value.trim();
  if (!title) { showToast('Título obrigatório', true); return; }
  await db.from('pbc_requests').insert({
    title, description: document.getElementById('m-desc').value,
    audit_id: document.getElementById('m-audit').value || null,
    owner_id: document.getElementById('m-owner').value || null,
    due_date: document.getElementById('m-due').value || null,
    status: 'Pending'
  });
  closeModal();
  showToast('PbC Request criado');
  renderPbc();
}

async function showNewEntityModal() {
  showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>Nova Entidade</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-control" id="m-name" placeholder="Ex: Contas a Receber">
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <input class="form-control" id="m-cat" placeholder="Ex: Finance">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-control" id="m-desc" rows="3"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="createEntity()">Criar</button>
      </div>
    </div>`);
}

async function createEntity() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { showToast('Nome obrigatório', true); return; }
  await db.from('audit_entities').insert({
    name, category: document.getElementById('m-cat').value,
    description: document.getElementById('m-desc').value
  });
  closeModal();
  showToast('Entidade criada');
  renderUniverse();
}

function showScopingModal(auditId) {
  showToast('Scoping memo - em desenvolvimento');
}

function showNewPlanModal() {
  showToast('Plano anual - em desenvolvimento');
}

function showNewLibraryTaskModal() {
  showToast('Biblioteca - em desenvolvimento');
}

function editLibraryTask(id) {
  showToast('Editar tarefa - em desenvolvimento');
}

// ============================================================
// HELPERS
// ============================================================
function switchPhase(el, phaseId) {
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['Opening','Fieldwork','Closing'].forEach(p => {
    const el = document.getElementById('phase-' + p);
    if (el) el.style.display = p === phaseId.replace('phase-','') ? 'block' : 'none';
  });
}

function switchSideTab(el, tab) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.sidebar-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('side-' + tab);
  if (sec) sec.classList.add('active');
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${isError ? '#dc2626' : '#16a34a'};
    color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;
    z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:fadeIn .2s`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-PT', { day:'2-digit', month:'short', year:'numeric' });
}

function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-PT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function statusBadge(s) {
  const m = { Planning:'badge-gray', Fieldwork:'badge-blue', Reporting:'badge-orange', Completed:'badge-green', Cancelled:'badge-gray' };
  return m[s] || 'badge-gray';
}

function phaseBadge(s) { return s; }

function resultBadge(r) {
  const m = { Effective:'badge-green', Ineffective:'badge-red', 'In Progress':'badge-blue', 'Not Started':'badge-gray' };
  return m[r] || 'badge-gray';
}

function severityBadge(s) {
  const m = { High:'severity-high', Medium:'severity-med', Low:'severity-low' };
  return m[s] || 'badge-gray';
}

function findingStatusBadge(s) {
  const m = { Open:'badge-red', 'In Remediation':'badge-orange', 'Pending Verification':'badge-blue', Closed:'badge-green' };
  return m[s] || 'badge-gray';
}

function pbcStatusBadge(s) {
  const m = { Pending:'badge-orange', Submitted:'badge-blue', Approved:'badge-green', Rejected:'badge-red' };
  return m[s] || 'badge-gray';
}

// ============================================================
// INIT
// ============================================================
navigate('dashboard');

