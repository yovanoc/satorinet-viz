import { Button } from "./ui/button";
import { siGithub } from "simple-icons";

export default function GitHubCorner() {
  return (
    <a
      href="https://github.com/yovanoc/satorinet-viz"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-4 right-4 z-50"
    >
      <Button variant="outline" size="icon" className="rounded-full p-4 shadow-lg">
        <div dangerouslySetInnerHTML={{ __html: siGithub.svg }} />
      </Button>
    </a>
  );
}
