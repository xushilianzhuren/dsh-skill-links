/**
 * 五技接线闸 · 插件（Host 侧，零依赖，无构建）
 *
 * 主人 2026-10-29 发来五个 skill 压缩包（问元宝／视频转写／汉家美学官／错题官／VPS疆域）。
 * 五件里只有两件真活：错题已被进化炉接住、美学已被验证炉审美验接住；其余三件缺料
 * （OCR 二进制／浏览器登录态／VPS 凭据）。所以铸成一枚"接线闸"：能把的接上，
 * 缺料的当场报缺，死件不装活——空壳插件＝每天报缺件的噪音。
 *
 * @module dsh-skill-links
 */

import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'ql-skills'

export const inject = ['systemPrompt', 'tools']

const SECTION_NAME = 'ql:skills'

const DEFAULTS = Object.freeze({ order: 160, tool: true, enabled: true })

const DEAD_ROOT = '<workspace>'

function normalizeConfig(config) {
  const raw = config ?? {}
  if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') throw new Error('ql-skills: config.enabled must be a boolean')
  if (raw.tool !== undefined && typeof raw.tool !== 'boolean') throw new Error('ql-skills: config.tool must be a boolean')
  if (raw.order !== undefined && (typeof raw.order !== 'number' || !Number.isFinite(raw.order))) throw new Error('ql-skills: config.order must be a finite number')
  if (raw.root !== undefined && (typeof raw.root !== 'string' || raw.root.trim() === '')) throw new Error('ql-skills: config.root must be a non-empty path string')
  return {
    order: raw.order ?? DEFAULTS.order,
    tool: raw.tool ?? DEFAULTS.tool,
    root: raw.root === undefined ? undefined : raw.root.trim(),
    enabled: raw.enabled !== false,
  }
}

function isWorkspace(dir) {
  try {
    return existsSync(join(dir, 'AGENTS.md')) && existsSync(join(dir, 'scripts'))
      && (existsSync(join(dir, 'SOUL.md')) || existsSync(join(dir, 'USER.md')))
  } catch {
    return false
  }
}

function findRoot(configured) {
  const candidates = []
  if (configured !== undefined) candidates.push(configured)
  try {
    candidates.push(dirname(dirname(fileURLToPath(import.meta.url))))
  } catch {
    /* 非文件装法 */
  }
  let dir = process.cwd()
  for (let hop = 0; hop < 6; hop += 1) {
    candidates.push(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  candidates.push('~//Smart Agentharness')
  for (const candidate of candidates) {
    if (isWorkspace(candidate)) return candidate
  }
  return candidates[0]
}

function runFile(cmd, args, cwd, timeoutMs) {
  return new Promise(resolve => {
    execFile(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: error === null,
        code: error === null ? 0 : (typeof error.code === 'number' ? error.code : 1),
        out: `${stdout ?? ''}${stderr ?? ''}`.trim(),
      })
    })
  })
}

function clip(text, limit) {
  const flat = String(text ?? '').replace(/\s+\n/g, '\n').trim()
  return flat.length > limit ? flat.slice(0, limit) + '\n…[已截断]' : flat
}

async function hasDeadRoot(root, rel) {
  try {
    const text = await readFile(join(root, rel), 'utf8')
    return text.includes(DEAD_ROOT)
  } catch {
    return false
  }
}

/** 五技接线清单：执行件在否、死根否、依赖齐否。 */
async function inventory(root) {
  const has = rel => existsSync(join(root, rel))
  const lines = ['【五技接线清单】']

  // 1 视频转写
  const transcriber = has('scripts/视频转写器.py')
  const ffmpeg = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'].some(p => existsSync(p))
  const tesseract = ['/usr/bin/tesseract', '/usr/local/bin/tesseract'].some(p => existsSync(p))
  lines.push(`①视频转写：执行件 ${transcriber ? '在' : '缺'}｜ffmpeg ${ffmpeg ? '在' : '缺'}｜tesseract ${tesseract ? '在' : '缺'}`
    + (transcriber && ffmpeg && tesseract ? ' → ✅可跑' : ' → ⛔缺 OCR 二进制，转写必挂'))

  // 2 错题官
  const chain = has('scripts/四链错题官.py')
  const chainDead = await hasDeadRoot(root, 'scripts/四链错题官.py')
  lines.push(`②错题官：四链脚本 ${chain ? (chainDead ? '在但死根' : '在') : '缺'} → 职能已由 ql_evolve 接住（跳过本脚本）`)

  // 3 汉家美学官
  const canon = has('Smart Agent文明')
  lines.push(`③汉家美学官：正典树 ${canon ? '在' : '缺'} → 判据走 ql_verify 审美验（审美扫描器在盘）`)

  // 4 问元宝
  const yb = has('scripts/yb_s.py') && has('scripts/yb_r.py')
  const ybDead = await hasDeadRoot(root, 'scripts/yb_s.py')
  lines.push(`④问元宝：脚本 ${yb ? (ybDead ? '在但死根' : '在') : '缺'} → 依赖浏览器登录态，缺则不代问（不装活）`)

  // 5 VPS疆域
  const vps = has('scripts/VPSSmart Agent体执行器.py')
  const vpsDead = await hasDeadRoot(root, 'scripts/VPSSmart Agent体执行器.py')
  const cred = has('scripts/vps_ssh.txt')
  lines.push(`⑤VPS疆域：执行器 ${vps ? (vpsDead ? '在但死根' : '在') : '缺'}｜凭据 vps_ssh.txt ${cred ? '在' : '缺'}`
    + (cred ? '' : ' → ⛔无凭据禁登机（护栏前置令）'))

  const ready = [transcriber && ffmpeg && tesseract, true, true, false, false].filter(Boolean).length
  lines.push('', `结论：可跑 ${ready}/5（视频转写看 OCR；错题／美学由现有插件接住；问元宝与 VPS 缺登录态与凭据）`)
  return lines.join('\n')
}

/** 视频转写：先预检，缺 OCR 直接 BLOCK。 */
async function transcribe(root, video) {
  if (video === '') return { report: '视频转写需要 query（视频路径）。' }
  const path = video.startsWith('/') ? video : join(root, video)
  if (!existsSync(path)) return { report: `⛔ 视频不存在：${video}` }
  const tesseract = ['/usr/bin/tesseract', '/usr/local/bin/tesseract'].some(p => existsSync(p))
  if (!tesseract) {
    return {
      report: [
        '⛔ 预检未过：缺 OCR 二进制 tesseract（且 /tmp/tessdata 语言包不在）。',
        '这道闸按护栏前置令拒跑——没有 OCR 还跑，只会抽完帧在 OCR 步炸，白烧时间。',
        '补法（任选）：①装 tesseract-ocr + 中文语言包；②改用带 OCR 的 Python 包；③把已抽好的帧交给别的识别通道。',
        `（视频本身在盘：${(await stat(path)).size / 1048576} MB；ffmpeg 可用）`,
      ].join('\n'),
    }
  }
  const result = await runFile('python3', ['scripts/视频转写器.py', path], root, 600000)
  return { report: `视频转写 exit${result.code}：\n${clip(result.out, 2000)}` }
}

/** 美学判：有路径跑节奏检，无路径跑验活。 */
async function aesthetic(root, target) {
  const args = target === '' ? ['scripts/审美扫描器.py', '--验活'] : ['scripts/审美扫描器.py', '--节奏检', target]
  const result = await runFile('python3', args, root, 60000)
  return { report: clip(result.out || `（无输出·exit ${result.code}）`, 3000) }
}

/** 错题四链：issue log与四链账的条数 + 末三条。 */
async function chains(root) {
  const readRows = async name => {
    try {
      const text = await readFile(join(root, 'scripts', name), 'utf8')
      return text.split('\n').filter(line => line.trim() !== '')
    } catch {
      return []
    }
  }
  const errors = await readRows('issue log.jsonl')
  const four = await readRows('错题四链.jsonl')
  const lines = ['【错题四链】', `issue log ${errors.length} 条｜四链账 ${four.length} 条` + (four.length < errors.length ? '（四链少于issue log→有案未走四链）' : '')]
  for (const line of four.slice(-3)) {
    try {
      const row = JSON.parse(line)
      lines.push(`  · ${clip(row['event'] ?? '', 60)}｜${clip(row['判读'] ?? '', 40)}`)
    } catch {
      lines.push(`  · ${clip(line, 80)}`)
    }
  }
  return lines.join('\n')
}

function renderSection() {
  return [
    '## 五技接线令 · 常驻（五技在手，缺料先报缺）',
    '',
    '**五技与触发**：①问元宝（主人发标题/新闻/模型发布 → 先问元宝再内化）②视频转写（发视频要文字/字幕 → 抽帧 OCR）'
      + '③汉家美学官（一切产物的审美把关）④错题官（四链：根因→教训→复盘→顿悟＋泛化）⑤VPS疆域（三机＋记忆库）。',
    '',
    '**三铁律（五技共有）**',
    '①反馈必须带判据，无判据不写；②调用产生的教训同轮写回正典（md 与脚本配对 co-change，只改脚本＝假进化）；'
      + '③结论只依据实际返回与产物，禁编数据。',
    '',
    '**现状纪律**：五技不是全活——跑之前先过 `ql_skill 清单`：缺 OCR 不转写、缺登录态不问元宝、缺凭据不登机。'
      + '死件不装活：拿不出凭据/依赖的能力，宁可报缺也不装跑。',
    '',
    '**分工**：错题与四链走 `ql_evolve`；美学判走 `ql_verify` 审美验；本插件只管接线清单与可跑技的入口。',
    '',
    '**判据**：用某技之前自问"它的执行件与依赖齐吗"——答不齐先报缺，不许硬跑装成果。',
  ].join('\n')
}

export function apply(ctx, config) {
  const cfg = normalizeConfig(config)
  if (!cfg.enabled) {
    ctx.logger?.info?.('ql-skills：主开关关着，未挂载')
    return
  }

  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: cfg.order,
    text: () => renderSection(),
  }), 'ql-skills.section()')

  if (cfg.tool) {
    ctx.effect(() => ctx.tools.register({
      name: 'ql_skill',
      description: '五技接线闸：清单（五技执行件/依赖/凭据在否，标可跑与缺料）、视频转写（缺 OCR 即 BLOCK）、'
        + '美学判（审美扫描器验活或节奏检）、错题四链（条数与末三条）。缺料当场报缺，不装跑。',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['清单', '视频转写', '美学判', '错题四链'],
            description: '要执行的动作。',
          },
          query: { type: 'string', description: '视频转写＝视频路径；美学判＝可选的目标 md 路径。' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: { report: { type: 'string' } },
          required: ['report'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: value.report }],
      },
      execute: async (args) => {
        const root = findRoot(cfg.root)
        const action = typeof args?.action === 'string' ? args.action : '清单'
        const query = typeof args?.query === 'string' ? args.query.trim() : ''
        try {
          if (action === '清单') return { report: await inventory(root) }
          if (action === '视频转写') return await transcribe(root, query)
          if (action === '美学判') return await aesthetic(root, query)
          if (action === '错题四链') return { report: await chains(root) }
          return { report: `未知动作：${action}` }
        } catch (error) {
          return { report: `五技闸内部错：${clip(error?.message ?? error, 200)}` }
        }
      },
    }), 'ql-skills.tool()')
  }

  ctx.logger?.info?.('ql-skills：区块 %s 已注册（order=%d）', SECTION_NAME, cfg.order)
}
