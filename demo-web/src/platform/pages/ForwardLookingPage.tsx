import type { ShellRouteId } from '../../sharedContracts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'

type ForwardLookingPageProps = {
  onNavigate: (routeId: ShellRouteId) => void
}

export function ForwardLookingPage({ onNavigate }: ForwardLookingPageProps) {
  return (
    <section className="module-page">
      <PlatformStatusSurface
        tone="deferred"
        title="Forward-Looking Analysis"
        summary="This area keeps collaborative decision support visible in the product shell without pretending the evidence package is already complete."
        detail="Not available in this version. The collaboration protocol, strategy evidence, and before/after benefit package will be connected in a later update."
        actions={[
          { label: 'Return home', onClick: () => onNavigate('home') },
          { label: 'Open evaluation', onClick: () => onNavigate('evaluation') },
        ]}
      />
    </section>
  )
}
