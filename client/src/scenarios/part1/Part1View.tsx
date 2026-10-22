import { FeatureGate } from '../../components/FeatureGate';
import { SiteFooter, SiteNav } from '../../components/SiteNav';
import { demoContext } from '../../ld/provider';
import { useIdentify } from '../../ld/useIdentify';

export function Part1View() {
  useIdentify(demoContext);
  return (
    <div className="landing">
      <SiteNav active="Reports" />
      <FeatureGate />
      <SiteFooter />
    </div>
  );
}
