"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-600">
          Não foi possível carregar os dados da giroteca. Tente novamente.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
