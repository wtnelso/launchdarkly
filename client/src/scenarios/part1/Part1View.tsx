import { FeatureGate } from '../../components/FeatureGate';
import { SiteFooter, SiteNav } from '../../components/SiteNav';
import { demoContext } from '../../ld/provider';
import { useIdentify } from '../../ld/useIdentify';

/** Part 1 end-user view: the Reports page, with the Insights dashboard behind the flag. */
export function Part1View() {
  // Part 1 is served to everyone; make sure a persona chosen in Part 2 doesn't linger.
  useIdentify(demoContext);
  return (
    <div className="landing">
      <SiteNav active="Reports" />
      <FeatureGate />
      <SiteFooter />
    </div>
  );
}
