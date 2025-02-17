import { Button } from "./ui/button";
import { Github } from "lucide-react";

export default function GitHubCorner() {
  return (
    <a
      href="https://github.com/yovanoc/satorinet-viz"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-4 right-4 z-50"
    >
      <Button variant="outline" size="icon" className="rounded-full p-2 shadow-lg">
        <Github className="w-64 h-64" />
      </Button>
    </a>
  );
}
