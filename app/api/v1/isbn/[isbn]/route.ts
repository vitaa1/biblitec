import { NextRequest, NextResponse } from "next/server";
import type { IsbnLookupResult } from "lib/isbn";

export type { IsbnLookupResult };

function fetchComTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    next: { revalidate: 86400 },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function buscarBrasilApi(isbn: string): Promise<IsbnLookupResult | null> {
  try {
    const res = await fetchComTimeout(
      `https://brasilapi.com.br/api/isbn/v1/${isbn}`,
      4000,
    );
    if (!res.ok) return null;

    const livro = await res.json();
    const autores = Array.isArray(livro.authors)
      ? livro.authors.join(", ")
      : undefined;

    return {
      titulo: livro.title || undefined,
      autores: autores || undefined,
      editora: livro.publisher || undefined,
      anoPublicacao: livro.year ? Number(livro.year) : undefined,
      descricao: livro.synopsis || undefined,
      capaUrl: livro.cover_url || undefined,
    };
  } catch {
    return null;
  }
}

async function buscarOpenLibrary(
  isbn: string,
): Promise<IsbnLookupResult | null> {
  try {
    const res = await fetchComTimeout(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      4000,
    );
    if (!res.ok) return null;

    const json = await res.json();
    const livro = json[`ISBN:${isbn}`];
    if (!livro) return null;

    const autores = livro.authors
      ?.map((a: { name: string }) => a.name)
      .join(", ");

    const ano = livro.publish_date
      ? Number(livro.publish_date.match(/\d{4}/)?.[0])
      : undefined;

    const capaUrl =
      livro.cover?.large ?? livro.cover?.medium ?? livro.cover?.small;

    return {
      titulo: livro.title || undefined,
      autores: autores || undefined,
      editora: livro.publishers?.[0]?.name || undefined,
      anoPublicacao: ano && !isNaN(ano) ? ano : undefined,
      descricao:
        typeof livro.notes?.value === "string"
          ? livro.notes.value
          : typeof livro.notes === "string"
            ? livro.notes
            : undefined,
      capaUrl: capaUrl || undefined,
    };
  } catch {
    return null;
  }
}

async function buscarGoogleBooks(
  isbn: string,
): Promise<IsbnLookupResult | null> {
  try {
    const res = await fetchComTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
      4000,
    );
    if (!res.ok) return null;

    const json = await res.json();
    const item = json.items?.[0]?.volumeInfo;
    if (!item) return null;

    const capaUrl =
      item.imageLinks?.thumbnail?.replace("http://", "https://") ||
      item.imageLinks?.smallThumbnail?.replace("http://", "https://");

    return {
      titulo: item.title || undefined,
      autores: item.authors?.join(", ") || undefined,
      editora: item.publisher || undefined,
      anoPublicacao: (() => {
        const ano = item.publishedDate
          ? Number(item.publishedDate.slice(0, 4))
          : undefined;
        return Number.isFinite(ano) ? ano : undefined;
      })(),
      descricao: item.description || undefined,
      capaUrl: capaUrl || undefined,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ isbn: string }> },
) {
  const { isbn } = await params;
  const isbnLimpo = isbn.replace(/-/g, "");

  if (!/^\d{10}$|^\d{13}$/.test(isbnLimpo)) {
    return NextResponse.json(
      { error: "ISBN inválido. Informe 10 ou 13 dígitos." },
      { status: 400 },
    );
  }

  // Consulta as 3 fontes em paralelo e mescla o melhor de cada uma.
  // BrasilAPI tem prioridade para texto (melhor cobertura de livros nacionais),
  // mas a capa vem de qualquer fonte que a tenha.
  const [brasil, openLib, google] = await Promise.all([
    buscarBrasilApi(isbnLimpo),
    buscarOpenLibrary(isbnLimpo),
    buscarGoogleBooks(isbnLimpo),
  ]);

  if (!brasil && !openLib && !google) {
    return NextResponse.json(
      { error: "ISBN não encontrado em nenhuma fonte." },
      { status: 404 },
    );
  }

  const resultado: IsbnLookupResult = {
    titulo: brasil?.titulo ?? openLib?.titulo ?? google?.titulo,
    autores: brasil?.autores ?? openLib?.autores ?? google?.autores,
    editora: brasil?.editora ?? openLib?.editora ?? google?.editora,
    anoPublicacao:
      brasil?.anoPublicacao ?? openLib?.anoPublicacao ?? google?.anoPublicacao,
    descricao: brasil?.descricao ?? openLib?.descricao ?? google?.descricao,
    capaUrl: brasil?.capaUrl ?? openLib?.capaUrl ?? google?.capaUrl,
  };

  return NextResponse.json(resultado);
}
