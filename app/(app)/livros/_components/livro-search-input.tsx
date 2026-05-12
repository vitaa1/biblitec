"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ISBN_REGEX = /^\d{10,13}$/;

interface LivroSearchInputProps {
  onSearch: (filtros: { q?: string; isbn?: string }) => void;
}

export function LivroSearchInput({ onSearch }: LivroSearchInputProps) {
  const [valor, setValor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const primeiroRender = useRef(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Evita disparar busca na montagem — initialData já veio do servidor
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const limpo = valor.trim();
      if (!limpo) {
        onSearch({});
        return;
      }
      const semHifens = limpo.replace(/-/g, "");
      if (ISBN_REGEX.test(semHifens)) {
        onSearch({ isbn: semHifens });
      } else {
        onSearch({ q: limpo });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [valor, onSearch]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="busca-livro">Buscar livro</Label>
      <Input
        ref={inputRef}
        id="busca-livro"
        type="search"
        placeholder="Título, autor ou ISBN..."
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="max-w-sm"
      />
    </div>
  );
}
