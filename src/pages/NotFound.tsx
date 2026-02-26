import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">[404]</p>
      <h1 className="text-4xl font-light text-fg mb-4">Not Found</h1>
      <p className="text-fg-muted mb-8">This page doesn't exist.</p>
      <Link to="/">
        <Button variant="primary">BACK TO HOME →</Button>
      </Link>
    </div>
  );
}
