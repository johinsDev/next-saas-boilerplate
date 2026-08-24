// react-email's CLI (`email dev`) scans this folder for previewable
// templates and expects each `.tsx` to expose a default export.
// Re-export from `src/templates/` so the source of truth stays there.
import { WelcomeEmail } from "../src/templates/welcome-email";

export default WelcomeEmail;
export { WelcomeEmail };
