import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link, useInRouterContext } from "react-router-dom";
/** Keep tools mounted during internal navigation; standalone panels also work without a router. */
const WorkspaceLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(function WorkspaceLink({ href = "#", ...props }, ref) {
  const routed = useInRouterContext();
  return routed ? <Link ref={ref} to={href} {...props} /> : <a ref={ref} href={href} {...props} />;
});
export default WorkspaceLink;
