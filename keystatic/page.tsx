import { Keystatic } from "@keystatic/core/page";
import keystaticConfig from "../keystatic.config";

export default function KeystaticPage() {
  return <Keystatic config={keystaticConfig} />;
}
