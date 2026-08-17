import { useEffect, useRef, useState, useCallback } from 'react'
import { Chessground } from 'chessground'
import { Chess, fen, parseUci, parseSquare, makeSquare, squareFile, isNormal, type Square } from 'chessops'
import { makeSanAndPlay } from 'chessops/san'
import { defaultGame, makePgn, type PgnNodeData, type Game, ChildNode, Node } from 'chessops/pgn'
import type { Key, Dests } from 'chessground/types'
import 'chessground/assets/chessground.base.css'
import 'chessground/assets/chessground.brown.css'
import 'chessground/assets/chessground.cburnett.css'
import Section from '../components/Section'
import './Ada.css'

type CgApi = ReturnType<typeof Chessground>

const API_URL = import.meta.env.VITE_ENGINE_URL ?? ''
const DEFAULT_MOVETIME = 1000

type Status = 'idle' | 'thinking' | 'over'

interface EngineStats {
  depth: number
  nodes: number
  score: number
}

interface AdaProps {
  menuOpen: boolean
}

export default function Ada({ menuOpen }: AdaProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const cgRef = useRef<CgApi | undefined>(undefined)
  const posRef = useRef<Chess>(Chess.default())
  const [initialPgn] = useState(() => {
    const game = defaultGame<PgnNodeData>()
    return { game, end: game.moves as Node<PgnNodeData> }
  })
  const pgnRef = useRef<Game<PgnNodeData>>(initialPgn.game)
  const pgnEndRef = useRef<Node<PgnNodeData>>(initialPgn.end)
  const lastMoveRef = useRef<[Key, Key] | undefined>(undefined)
  const abortRef = useRef<AbortController | undefined>(undefined)

  const [status, setStatus] = useState<Status>('idle')
  const [stats, setStats] = useState<EngineStats | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)
  const [movetime, setMovetime] = useState(DEFAULT_MOVETIME)
  const [fenInput, setFenInput] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const orientationRef = useRef<'white' | 'black'>('white')

  const recordMove = useCallback((pos: Chess, move: ReturnType<typeof parseUci>) => {
    if (!move || !isNormal(move)) return
    const clone = pos.clone()
    const san = makeSanAndPlay(clone, move)
    const node = new ChildNode<PgnNodeData>({ san })
    pgnEndRef.current.children.push(node)
    pgnEndRef.current = node
  }, [])

  const buildDests = useCallback((pos: Chess) => {
    const dests = new Map<Key, Key[]>()
    const all = pos.allDests()
    for (const [from, targets] of all) {
      const fromKey = makeSquare(from as Square) as Key
      const piece = pos.board.get(from as Square)
      const tos: Key[] = []
      for (const to of targets) {
        // chessops returns the rook's square as the castling destination
        // (Chess960 style). Convert to the king's actual target square so
        // chessground lets the user drag the king two squares. Only apply
        // to actual castling moves (king traveling more than one file);
        // a normal one-square king move to a corner must stay as-is.
        if (piece?.role === 'king' && Math.abs(squareFile(to as Square) - squareFile(from as Square)) > 1) {
          const toKey = makeSquare(to as Square)
          if (toKey === 'h1') { tos.push('g1' as Key); continue }
          if (toKey === 'a1') { tos.push('c1' as Key); continue }
          if (toKey === 'h8') { tos.push('g8' as Key); continue }
          if (toKey === 'a8') { tos.push('c8' as Key); continue }
        }
        tos.push(makeSquare(to as Square) as Key)
      }
      dests.set(fromKey, tos)
    }
    return dests as Dests
  }, [])

  const syncBoard = useCallback(() => {
    const pos = posRef.current
    const cg = cgRef.current
    if (!cg) return

    const fenStr = fen.makeFen(pos.toSetup())
    const turnColor = pos.turn === 'white' ? 'white' : 'black'
    const isCheck = pos.isCheck()
    const o = pos.outcome()

    cg.set({
      fen: fenStr,
      turnColor,
      check: isCheck ? turnColor : false,
      lastMove: lastMoveRef.current,
      movable: {
        free: false,
        color: orientationRef.current,
        dests: buildDests(pos),
        showDests: true,
      },
    })

    if (o) {
      setStatus('over')
      if (o.winner) {
        setOutcome(o.winner === 'white' ? 'White wins' : 'Black wins')
      } else {
        setOutcome('Draw')
      }
    }
  }, [buildDests])

  const engineMove = useCallback(async () => {
    const pos = posRef.current
    if (pos.outcome()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('thinking')
    setStats(null)

    const fenStr = fen.makeFen(pos.toSetup())
    try {
      const res = await fetch(`${API_URL}/api/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: fenStr, movetimeMs: movetime }),
        signal: controller.signal,
      })
      if (!res.ok) {
        if (!controller.signal.aborted) setStatus('idle')
        return
      }
      const data = await res.json() as { move: string; depth: number; nodes: number; score: number }
      const reply = parseUci(data.move)
      if (!reply || !isNormal(reply)) {
        if (!controller.signal.aborted) setStatus('idle')
        return
      }

      if (controller.signal.aborted) return
      recordMove(pos, reply)
      pos.play(reply)
      lastMoveRef.current = [makeSquare(reply.from) as Key, makeSquare(reply.to) as Key]
      setStats({ depth: data.depth, nodes: data.nodes, score: data.score })
      syncBoard()

      const o = pos.outcome()
      if (o) {
        setStatus('over')
        setOutcome(o.winner ? (o.winner === 'white' ? 'White wins' : 'Black wins') : 'Draw')
      } else {
        setStatus('idle')
        cgRef.current?.playPremove()
      }
    } catch {
      if (controller.signal.aborted) return
      setStatus('idle')
    }
  }, [movetime, syncBoard, recordMove])

  const onUserMove = useCallback(async (from: Key, to: Key) => {
    const pos = posRef.current

    // Check if promotion is needed: pawn reaching last rank
    const fromSq = parseSquare(from)
    const piece = fromSq !== undefined ? pos.board.get(fromSq) : undefined
    const isPromo = piece?.role === 'pawn' && (to[1] === '8' || to[1] === '1')

    const uci = from + to + (isPromo ? 'q' : '')
    const move = parseUci(uci)
    if (!move) return

    recordMove(pos, move)
    pos.play(move)
    lastMoveRef.current = [from, to]
    syncBoard()

    const o = pos.outcome()
    if (o) {
      setStatus('over')
      setOutcome(o.winner ? (o.winner === 'white' ? 'White wins' : 'Black wins') : 'Draw')
    } else {
      await engineMove()
    }
  }, [engineMove, syncBoard, recordMove])

  const setPlayerHeaders = useCallback((game: Game<PgnNodeData>, side: 'white' | 'black') => {
    game.headers.set('White', side === 'white' ? 'You' : 'AdaEngine')
    game.headers.set('Black', side === 'white' ? 'AdaEngine' : 'You')
  }, [])

  const newGame = useCallback((side: 'white' | 'black') => {
    abortRef.current?.abort()
    posRef.current = Chess.default()
    pgnRef.current = defaultGame()
    setPlayerHeaders(pgnRef.current, side)
    pgnEndRef.current = pgnRef.current.moves
    lastMoveRef.current = undefined
    setStats(null)
    setOutcome(null)
    setStatus('idle')
    setFenInput('')
    orientationRef.current = side
    setOrientation(side)
    syncBoard()
    if (side === 'black') {
      engineMove()
    }
  }, [syncBoard, engineMove, setPlayerHeaders])

  const currentFen = useCallback(() => fen.makeFen(posRef.current.toSetup()), [])

  const loadFen = useCallback(() => {
    const setup = fen.parseFen(fenInput.trim())
    if (!setup.isOk) return
    const pos = Chess.fromSetup(setup.value)
    if (!pos.isOk) return
    abortRef.current?.abort()
    posRef.current = pos.value
    pgnRef.current = defaultGame()
    setPlayerHeaders(pgnRef.current, orientation)
    pgnEndRef.current = pgnRef.current.moves
    lastMoveRef.current = undefined
    setStats(null)
    setOutcome(null)
    setStatus('idle')
    syncBoard()
    if (pos.value.turn !== orientation) {
      engineMove()
    }
  }, [fenInput, syncBoard, orientation, setPlayerHeaders, engineMove])

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!boardRef.current) return
    cgRef.current = Chessground(boardRef.current, {
      fen: fen.makeFen(posRef.current.toSetup()),
      orientation,
      movable: {
        free: false,
        color: orientation,
        dests: buildDests(posRef.current),
        showDests: true,
        events: {
          after: (orig, dest) => onUserMove(orig, dest),
        },
      },
      premovable: {
        enabled: true,
        showDests: true,
        castle: true,
      },
      animation: { enabled: true },
      coordinates: false,
    })
    return () => {
      cgRef.current?.destroy()
      cgRef.current = undefined
    }
  }, [buildDests, onUserMove, orientation])

  return (
    <div className={`ada-page graph-paper${menuOpen ? ' menu-open' : ''}`}>
      <Section width={8} height={6} color="white">
        <div className="ada-board-area">
          <div ref={boardRef} className="cg-wrap" />
        </div>
        <div className="ada-side">
          <h1>AdaEngine</h1>
          <p>Play against my chess engine, written from scratch in Go. Read about it <a href="https://github.com/WilliamDann/AdaEngine">on GitHub</a>.</p>

          <div className="ada-controls">
            <label>
              Speed
              <select value={movetime} onChange={e => setMovetime(Number(e.target.value))}>
                <option value={250}>Bullet (250ms)</option>
                <option value={1000}>Blitz (1s)</option>
                <option value={3000}>Rapid (3s)</option>
                <option value={5000}>Classical (5s)</option>
              </select>
            </label>
            <div className="ada-new-game">
              <span>New Game:</span>
              <button onClick={() => newGame('white')} disabled={status === 'thinking'}>White</button>
              <button onClick={() => newGame('black')} disabled={status === 'thinking'}>Black</button>
              <button onClick={() => newGame(Math.random() < 0.5 ? 'white' : 'black')} disabled={status === 'thinking'}>Random</button>
            </div>
          </div>

          <div className="ada-status">
            {status === 'thinking' && <p>Ada is thinking…</p>}
            {status === 'over' && <p><b>Game over: {outcome}</b></p>}
            {status === 'idle' && <p>Your move.</p>}
          </div>

          {stats && (
            <div className="ada-stats">
              <table>
                <tbody>
                  <tr><td>Depth</td><td>{stats.depth}</td></tr>
                  <tr><td>Nodes</td><td>{stats.nodes.toLocaleString()}</td></tr>
                  <tr><td>Score</td><td>{(stats.score / 100).toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="ada-fen-controls">
            <div className="ada-fen-row">
              <input
                type="text"
                value={fenInput}
                onChange={e => setFenInput(e.target.value)}
                placeholder="Paste FEN to load position…"
                className="ada-fen-input"
              />
              <button onClick={loadFen}>Load</button>
            </div>
            <div className="ada-copy-row">
              <button onClick={() => copyToClipboard(currentFen(), 'FEN')}>
                Copy FEN
              </button>
              <button onClick={() => copyToClipboard(makePgn(pgnRef.current), 'PGN')}>
                Copy PGN
              </button>
              {copied && <span className="ada-copied">Copied {copied}!</span>}
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
