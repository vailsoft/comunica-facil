import React, { useState, useEffect } from "react";

// Função para inicializar o banco de dados
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('comunicaFacilDB', 2); // Aumentamos a versão para criar nova store

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('cartoes')) {
        db.createObjectStore('cartoes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessoes')) {
        db.createObjectStore('sessoes', { keyPath: 'id' });
      }
    };
  });
};

// Funções para gerenciar sessões
const salvarSessoes = async (sessoes) => {
  const db = await initDB();
  const tx = db.transaction('sessoes', 'readwrite');
  const store = tx.objectStore('sessoes');
  
  await store.clear();
  sessoes.forEach(sessao => {
    store.add(sessao);
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const carregarSessoes = async () => {
  const db = await initDB();
  const tx = db.transaction('sessoes', 'readonly');
  const store = tx.objectStore('sessoes');
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Funções para gerenciar cartões
const salvarCartoes = async (cartoes) => {
  const db = await initDB();
  const tx = db.transaction('cartoes', 'readwrite');
  const store = tx.objectStore('cartoes');
  
  await store.clear();
  cartoes.forEach(cartao => {
    store.add(cartao);
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const carregarCartoes = async () => {
  const db = await initDB();
  const tx = db.transaction('cartoes', 'readonly');
  const store = tx.objectStore('cartoes');
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export default function ComunicaFacil() {
  const [cartoes, setCartoes] = useState([]);
  const [sessoes, setSessoes] = useState([{ id: 'principal', nome: 'Principal', cartoes: [] }]);
  const [sessaoAtual, setSessaoAtual] = useState('principal');
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState(null);
  const [mostrarCriacao, setMostrarCriacao] = useState(false);
  const [mostrarCriacaoSessao, setMostrarCriacaoSessao] = useState(false);
  const [novaSessao, setNovaSessao] = useState("");
  const [mostrarModalMover, setMostrarModalMover] = useState(false);
  const [cartaoParaMover, setCartaoParaMover] = useState(null);
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null);
  const [mostrarModalExcluir, setMostrarModalExcluir] = useState(false);

  // Carrega os dados quando o componente é montado
  useEffect(() => {
    const loadDados = async () => {
      try {
        const [cartoesCarregados, sessoesCarregadas] = await Promise.all([
          carregarCartoes(),
          carregarSessoes()
        ]);
        
        if (sessoesCarregadas.length > 0) {
          setSessoes(sessoesCarregadas);
        }
        
        if (cartoesCarregados.length > 0) {
          setCartoes(cartoesCarregados);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };
    loadDados();
  }, []);

  // Salva os dados quando houver mudanças
  useEffect(() => {
    const salvarDados = async () => {
      try {
        await Promise.all([
          salvarCartoes(cartoes),
          salvarSessoes(sessoes)
        ]);
      } catch (error) {
        console.error('Erro ao salvar dados:', error);
      }
    };
    salvarDados();
  }, [cartoes, sessoes]);

  const handleCriarCartao = () => {
    if (!texto || !imagem) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const novoCartao = {
        id: Date.now(),
        texto,
        imagem: reader.result,
        sessaoId: sessaoAtual
      };
      
      setCartoes(prevCartoes => [...prevCartoes, novoCartao]);
      setSessoes(prevSessoes => 
        prevSessoes.map(sessao => 
          sessao.id === sessaoAtual 
            ? { ...sessao, cartoes: [...sessao.cartoes, novoCartao.id] }
            : sessao
        )
      );
      
      setTexto("");
      setImagem(null);
    };
    reader.readAsDataURL(imagem);
  };

  const handleCriarSessao = () => {
    if (!novaSessao.trim()) return;
    
    const novaSessaoObj = {
      id: Date.now().toString(),
      nome: novaSessao,
      cartoes: []
    };
    
    setSessoes(prev => [...prev, novaSessaoObj]);
    setNovaSessao("");
  };

  const handleMoverCartao = (cartaoId, novaSessaoId) => {
    setSessoes(prevSessoes => 
      prevSessoes.map(sessao => {
        if (sessao.id === sessaoAtual) {
          return { ...sessao, cartoes: sessao.cartoes.filter(id => id !== cartaoId) };
        }
        if (sessao.id === novaSessaoId) {
          return { ...sessao, cartoes: [...sessao.cartoes, cartaoId] };
        }
        return sessao;
      })
    );
    
    setCartoes(prevCartoes =>
      prevCartoes.map(cartao =>
        cartao.id === cartaoId ? { ...cartao, sessaoId: novaSessaoId } : cartao
      )
    );
    
    setMostrarModalMover(false);
    setCartaoParaMover(null);
  };

  const handleExcluirCartao = (cartaoId) => {
    // Remove o cartão da lista de cartões
    setCartoes(prevCartoes => prevCartoes.filter(cartao => cartao.id !== cartaoId));
    
    // Remove o ID do cartão da sessão
    setSessoes(prevSessoes => 
      prevSessoes.map(sessao => ({
        ...sessao,
        cartoes: sessao.cartoes.filter(id => id !== cartaoId)
      }))
    );

    setMostrarModalExcluir(false);
    setCartaoParaExcluir(null);
  };

  const lerTexto = (texto) => {
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
  };

  const cartoesNaSessaoAtual = cartoes.filter(cartao => cartao.sessaoId === sessaoAtual);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">ComunicaFácil - Criador de Cartões Visuais</h1>

      {/* Lista de Sessões */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Sessões</h2>
        <div className="flex gap-2 flex-wrap bg-gray-100 p-4 rounded-lg">
          {sessoes.map(sessao => (
            <button
              key={sessao.id}
              onClick={() => setSessaoAtual(sessao.id)}
              className={`px-4 py-2 rounded-full ${
                sessaoAtual === sessao.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white hover:bg-gray-200'
              }`}
            >
              {sessao.nome} ({sessao.cartoes.length})
            </button>
          ))}
        </div>
      </div>

      {/* Botões de Criação */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMostrarCriacao(!mostrarCriacao)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          {mostrarCriacao ? "Ocultar Criação de Cartões" : "Criar Cartões"}
        </button>

        <button
          onClick={() => setMostrarCriacaoSessao(!mostrarCriacaoSessao)}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          {mostrarCriacaoSessao ? "Ocultar Criação de Sessão" : "Criar Sessão"}
        </button>
      </div>

      {/* Área de Criação de Sessão */}
      {mostrarCriacaoSessao && (
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-3">Nova Sessão</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={novaSessao}
              onChange={(e) => setNovaSessao(e.target.value)}
              placeholder="Nome da nova sessão"
              className="border p-2 rounded flex-1"
            />
            <button
              onClick={handleCriarSessao}
              className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Área de Criação de Cartões */}
      {mostrarCriacao && (
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <div className="space-y-4">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImagem(e.target.files[0])}
              className="border p-2 rounded w-full"
            />
            <textarea
              placeholder="Digite o texto do cartão (ex: Quero água)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="border p-2 rounded w-full"
            />
            <button
              onClick={handleCriarCartao}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Criar Cartão
            </button>
          </div>

          <div className="space-y-4">
            <h2 className="font-semibold">Prévia:</h2>
            {imagem && texto && (
              <div className="border rounded-2xl overflow-hidden shadow">
                <img 
                  src={imagem ? URL.createObjectURL(imagem) : ''} 
                  alt="Prévia" 
                  className="w-full h-48 object-cover" 
                />
                <div className="p-4 text-center text-lg font-medium">{texto}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de Cartões */}
      <h2 className="text-xl font-semibold mb-2">
        Cartões na Sessão: {sessoes.find(s => s.id === sessaoAtual)?.nome}
      </h2>
      
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cartoesNaSessaoAtual.map((cartao) => (
          <div 
            key={cartao.id} 
            className="relative border rounded-2xl overflow-hidden shadow cursor-pointer transform transition-transform hover:scale-105"
          >
            <div
              onClick={() => lerTexto(cartao.texto)}
              title="Clique para ouvir"
              className="w-full h-full"
            >
              <img src={cartao.imagem} alt="Cartão" className="w-full h-48 object-cover" />
              <div className="p-4 text-center text-lg font-medium">{cartao.texto}</div>
            </div>
            
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => {
                  setCartaoParaMover(cartao);
                  setMostrarModalMover(true);
                }}
                className="bg-white p-2 rounded-full shadow hover:bg-gray-100"
                title="Mover para outra sessão"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCartaoParaExcluir(cartao);
                  setMostrarModalExcluir(true);
                }}
                className="bg-white p-2 rounded-full shadow hover:bg-gray-100"
                title="Excluir cartão"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para mover cartão */}
      {mostrarModalMover && cartaoParaMover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Mover cartão para sessão:</h3>
            <div className="space-y-2">
              {sessoes
                .filter(sessao => sessao.id !== sessaoAtual)
                .map(sessao => (
                  <button
                    key={sessao.id}
                    onClick={() => handleMoverCartao(cartaoParaMover.id, sessao.id)}
                    className="w-full text-left p-2 hover:bg-gray-100 rounded"
                  >
                    {sessao.nome}
                  </button>
                ))}
            </div>
            <button
              onClick={() => {
                setMostrarModalMover(false);
                setCartaoParaMover(null);
              }}
              className="mt-4 w-full bg-gray-200 p-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmação para excluir cartão */}
      {mostrarModalExcluir && cartaoParaExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmar exclusão</h3>
            <p className="mb-6">
              Tem certeza que deseja excluir o cartão "{cartaoParaExcluir.texto}"? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleExcluirCartao(cartaoParaExcluir.id)}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Excluir
              </button>
              <button
                onClick={() => {
                  setMostrarModalExcluir(false);
                  setCartaoParaExcluir(null);
                }}
                className="flex-1 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
