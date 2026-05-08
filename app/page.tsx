import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <h1>Biblitec</h1>
          </CardTitle>
          <CardDescription>
            Sistema de gestão das girotecas da rede municipal de Teresina
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Acessar o sistema</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
