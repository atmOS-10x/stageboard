import type { ReactNode } from "react"
import type { Meta, Story } from "stageboard"
import { AgentStack, CopyPromptButton } from "./copy-prompt"
import { FlowViewerDemo, FlowsDemo } from "./demos"
import { PixelWaves } from "./pixel-waves"
import { SetupVisual, VariantVisual } from "../sections/workflow"

export default { title: "Landing/Components", parameters: { layout: "fullscreen" } } satisfies Meta

const Pad = ({ children }: { children: ReactNode }) => <div className="grid min-h-[320px] place-items-center p-10">{children}</div>

export const CopyButton: Story = { render: () => <Pad><CopyPromptButton /></Pad> }
export const CopyButtonSmall: Story = { render: () => <Pad><CopyPromptButton size="md" label="Copy prompt" /></Pad> }
export const Agents: Story = { render: () => <Pad><AgentStack /></Pad> }
export const Waves: Story = { render: () => <div className="h-[420px]"><PixelWaves /></div> }
export const FlowsBuilding: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowsDemo /></div> }
export const FlowViewer: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowViewerDemo /></div> }
export const FlowsAssembling: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowsDemo at={3000} /></div> }
export const FlowsRevealing: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowsDemo at={4900} /></div> }
export const ViewerWalking: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowViewerDemo at={1600} /></div> }
export const ViewerComment: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowViewerDemo at={6900} /></div> }
export const ViewerDrawn: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowViewerDemo at={9200} /></div> }
export const ViewerMoved: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowViewerDemo at={10900} /></div> }
export const ViewerReconciled: Story = { render: () => <div className="mx-auto max-w-6xl p-4 sm:p-8"><FlowViewerDemo at={13500} /></div> }
export const SetupStep: Story = { render: () => <div className="mx-auto max-w-3xl p-8"><SetupVisual /></div> }
export const VariantStep: Story = { render: () => <div className="mx-auto max-w-3xl p-8"><VariantVisual /></div> }
