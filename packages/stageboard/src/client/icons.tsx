import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Component,
  Copy,
  Ellipsis,
  ExternalLink,
  Monitor,
  Moon,
  Sun,
  Image,
  Info,
  Layers,
  MessageSquarePlus,
  MessagesSquare,
  MousePointer2,
  PencilLine,
  Pen,
  Plus,
  Sparkles,
  Square,
  SquareMousePointer,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react"

type Props = { size?: number }

function icon(Glyph: LucideIcon, strokeWidth = 1.75) {
  return function StageboardIcon({ size = 14 }: Props) {
    return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  }
}

export const AnnotateIcon = icon(MessageSquarePlus)
export const InspectIcon = icon(SquareMousePointer)
export const PlusIcon = icon(Plus)
export const ArrowUpIcon = icon(ArrowUp, 2.25)
export const CloseIcon = icon(X)
export const CheckIcon = icon(Check, 2)
export const AlertIcon = icon(CircleAlert)
export const LayersIcon = icon(Layers)
export const SparkIcon = icon(Sparkles)
export const ImageIcon = icon(Image)
export const PointerIcon = icon(MousePointer2)
export const PenIcon = icon(Pen)
export const SquareIcon = icon(Square)
export const ComponentIcon = icon(Component)
export const UndoIcon = icon(Undo2)
export const SketchIcon = icon(PencilLine)
export const PrevIcon = icon(ChevronLeft, 2)
export const NextIcon = icon(ChevronRight, 2)
export const FlowNoteIcon = icon(MessagesSquare)
export const CopyIcon = icon(Copy)
export const MoreIcon = icon(Ellipsis)
export const ExternalIcon = icon(ExternalLink)
export const MonitorIcon = icon(Monitor)
export const MoonIcon = icon(Moon)
export const SunIcon = icon(Sun)
export const InfoIcon = icon(Info)
