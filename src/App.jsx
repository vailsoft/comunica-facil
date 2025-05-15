import React, { useState, useEffect, useRef } from "react";
import { createPortal } from 'react-dom';

// Função para inicializar o banco de dados
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('comunicaFacilDB', 2);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('cartoes')) {
        db.createObjectStore('cartoes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessoes')) {
        const sessoesStore = db.createObjectStore('sessoes', { keyPath: 'id' });
        // Adiciona a sessão Principal por padrão
        sessoesStore.add({ id: 'principal', nome: 'Principal', cartoes: [] });
      }
    };
  });
};

// Funções para gerenciar sessões
const salvarSessoes = async (sessoes) => {
  try {
    const db = await initDB();
    const tx = db.transaction('sessoes', 'readwrite');
    const store = tx.objectStore('sessoes');
    
    // Limpa o store e adiciona todas as sessões
    await store.clear();
    const promises = sessoes.map(sessao => store.add(sessao));
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      Promise.all(promises).catch(reject);
    });
  } catch (error) {
    console.error('Erro ao salvar sessões:', error);
    throw error;
  }
};

const carregarSessoes = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction('sessoes', 'readonly');
    const store = tx.objectStore('sessoes');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const sessoes = request.result;
        // Garante que a sessão Principal existe e está na primeira posição
        const principal = sessoes.find(s => s.id === 'principal') || 
                         { id: 'principal', nome: 'Principal', cartoes: [] };
        const outrasSessoes = sessoes.filter(s => s.id !== 'principal');
        resolve([principal, ...outrasSessoes]);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Erro ao carregar sessões:', error);
    return [{ id: 'principal', nome: 'Principal', cartoes: [] }];
  }
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
  const [sessoes, setSessoes] = useState([]);
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
  const [sessaoParaExcluir, setSessaoParaExcluir] = useState(null);
  const [mostrarModalExcluirSessao, setMostrarModalExcluirSessao] = useState(false);
  const [mostrarOpcoesSessao, setMostrarOpcoesSessao] = useState(null);
  const [sessaoComLixeira, setSessaoComLixeira] = useState(null);
  const [sessaoComControles, setSessaoComControles] = useState(null);
  const sessionsRef = useRef(null);
  const longPressTimerRef = useRef(null);

  // Carrega os dados quando o componente é montado
  useEffect(() => {
    const loadDados = async () => {
      try {
        const [cartoesCarregados, sessoesCarregadas] = await Promise.all([
          carregarCartoes(),
          carregarSessoes()
        ]);
        
        setSessoes(sessoesCarregadas);
        
        if (cartoesCarregados.length > 0) {
          setCartoes(cartoesCarregados);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setSessoes([{ id: 'principal', nome: 'Principal', cartoes: [] }]);
      }
    };
    loadDados();
  }, []);

  // Salva os dados quando houver mudanças
  useEffect(() => {
    const salvarDados = async () => {
      try {
        if (sessoes.length > 0) {
          await Promise.all([
            salvarCartoes(cartoes),
            salvarSessoes(sessoes)
          ]);
        }
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
    
    setSessoes(prev => {
      const [principal, ...outras] = prev;
      return [principal, novaSessaoObj, ...outras];
    });
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

  const handleExcluirSessao = (sessaoId) => {
    if (sessaoId === 'principal') {
      alert('A sessão Principal não pode ser excluída');
      return;
    }

    setSessoes(prevSessoes => {
      // Encontra a sessão que será excluída
      const sessaoParaExcluir = prevSessoes.find(s => s.id === sessaoId);
      if (!sessaoParaExcluir) return prevSessoes;

      // Move os cartões da sessão excluída para a Principal
      const sessoesAtualizadas = prevSessoes.map(sessao => {
        if (sessao.id === 'principal') {
          return {
            ...sessao,
            cartoes: [...sessao.cartoes, ...sessaoParaExcluir.cartoes]
          };
        }
        return sessao;
      });

      // Remove a sessão excluída
      const sessoesFinais = sessoesAtualizadas.filter(s => s.id !== sessaoId);

      // Atualiza os cartões para a sessão principal
      setCartoes(prevCartoes => 
        prevCartoes.map(cartao => 
          cartao.sessaoId === sessaoId ? { ...cartao, sessaoId: 'principal' } : cartao
        )
      );

      // Se a sessão atual for excluída, volta para a principal
      if (sessaoId === sessaoAtual) {
        setSessaoAtual('principal');
      }

      return sessoesFinais;
    });

    setMostrarModalExcluirSessao(false);
    setSessaoParaExcluir(null);
  };

  const moverSessao = (sessaoId, direcao) => {
    setSessoes(prevSessoes => {
      const index = prevSessoes.findIndex(s => s.id === sessaoId);
      
      // Não permite mover se:
      // - For a sessão Principal
      // - Tentar mover para antes da Principal (index 1 -> 0)
      // - Tentar mover para depois da última sessão
      if (
        sessaoId === 'principal' ||
        (direcao === 'esquerda' && index <= 1) ||
        (direcao === 'direita' && index === prevSessoes.length - 1)
      ) {
        return prevSessoes;
      }

      const novasSessoes = [...prevSessoes];
      const novoIndex = direcao === 'esquerda' ? index - 1 : index + 1;
      
      // Troca as posições
      [novasSessoes[index], novasSessoes[novoIndex]] = 
      [novasSessoes[novoIndex], novasSessoes[index]];
      
      return novasSessoes;
    });
  };

  const lerTexto = (texto) => {
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
  };

  const cartoesNaSessaoAtual = cartoes.filter(cartao => cartao.sessaoId === sessaoAtual);

  const scrollSessions = (direction) => {
    if (sessionsRef.current) {
      const scrollAmount = 200; // Ajuste conforme necessário
      const newScrollPosition = sessionsRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
      sessionsRef.current.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleLongPress = (sessaoId) => {
    if (sessaoId === 'principal') return;
    longPressTimerRef.current = setTimeout(() => {
      setSessaoComControles(sessaoId);
    }, 500);
  };

  const handlePressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  // Adicionar manipulador de clique global para esconder os controles
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sessaoComControles && !event.target.closest('.session-item')) {
        setSessaoComControles(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [sessaoComControles]);

  return (
    <div className="app-container">
      <h1 className="app-title">ComunicaFácil - Criador de Cartões Visuais</h1>

      {/* Lista de Sessões */}
      <div className="sessions-container">
        <button
          onClick={() => scrollSessions('left')}
          className="scroll-button left"
          aria-label="Rolar sessões para esquerda"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="sessions-scroll" ref={sessionsRef}>
          {sessoes.map((sessao, index) => (
            <div key={sessao.id} className="session-item relative">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSessaoAtual(sessao.id)}
                  onMouseDown={() => handleLongPress(sessao.id)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleLongPress(sessao.id);
                  }}
                  onTouchEnd={handlePressEnd}
                  className={`session-button ${sessaoAtual === sessao.id ? 'active' : ''}`}
                >
                  {sessao.nome} ({sessao.cartoes.length})
                </button>
                {sessao.id !== 'principal' && sessaoComControles === sessao.id && (
                  <div className="session-controls flex items-center gap-1">
                    {index > 1 && (
                      <button
                        onClick={() => {
                          moverSessao(sessao.id, 'esquerda');
                          setSessaoComControles(null);
                        }}
                        className="control-button"
                        title="Mover para esquerda"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {index < sessoes.length - 1 && (
                      <button
                        onClick={() => {
                          moverSessao(sessao.id, 'direita');
                          setSessaoComControles(null);
                        }}
                        className="control-button"
                        title="Mover para direita"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleExcluirSessao(sessao.id)}
                      className="delete-session-button"
                      title="Excluir sessão"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => scrollSessions('right')}
          className="scroll-button right"
          aria-label="Rolar sessões para direita"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Botões de Criação */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMostrarCriacao(!mostrarCriacao)}
          className="button-primary px-4 py-2 rounded"
        >
          {mostrarCriacao ? "Ocultar Criação de Cartões" : "Criar Cartões"}
        </button>

        <button
          onClick={() => setMostrarCriacaoSessao(!mostrarCriacaoSessao)}
          className="button-primary px-4 py-2 rounded"
        >
          {mostrarCriacaoSessao ? "Ocultar Criação de Sessão" : "Criar Sessão"}
        </button>
      </div>

      {/* Área de Criação de Sessão */}
      {mostrarCriacaoSessao && (
        <div className="card-container mb-6">
          <h3 className="font-semibold mb-3">Nova Sessão</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={novaSessao}
              onChange={(e) => setNovaSessao(e.target.value)}
              placeholder="Nome da nova sessão"
              className="input-field flex-1"
            />
            <button
              onClick={handleCriarSessao}
              className="button-primary px-6 py-2 rounded"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Área de Criação de Cartões */}
      {mostrarCriacao && (
        <div className="card-container mb-8">
          <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImagem(e.target.files[0])}
                className="input-field w-full"
                id="fileInput"
              />
            </div>
            <button
              onClick={() => {
                // Tenta abrir a câmera usando a API getUserMedia
                navigator.mediaDevices.getUserMedia({ 
                  video: { facingMode: 'user' } // câmera frontal
                })
                .then(stream => {
                  // Cria elementos de vídeo e canvas
                  const videoEl = document.createElement('video');
                  const canvasEl = document.createElement('canvas');
                  
                  // Configura o vídeo
                  videoEl.srcObject = stream;
                  videoEl.autoplay = true;
                  videoEl.style.width = '100%';
                  videoEl.style.maxWidth = '400px';
                  
                  // Cria o modal para a câmera
                  const modalDiv = document.createElement('div');
                  modalDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
                  modalDiv.innerHTML = `
                    <div class="modal-content p-6 max-w-md w-full">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="modal-title text-lg">Tirar Foto</h3>
                        <button id="switchCamera" class="button-primary p-2 rounded">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
                          </svg>
                        </button>
                      </div>
                      <div id="videoContainer" class="relative mb-4"></div>
                      <div class="flex gap-4">
                        <button id="captureBtn" class="flex-1 modal-button-primary p-2 rounded">Capturar</button>
                        <button id="cancelBtn" class="flex-1 modal-button-secondary p-2 rounded">Cancelar</button>
                      </div>
                    </div>
                  `;
                  
                  document.body.appendChild(modalDiv);
                  document.getElementById('videoContainer').appendChild(videoEl);
                  
                  // Função para trocar a câmera
                  let isFrontCamera = true;
                  document.getElementById('switchCamera').onclick = () => {
                    isFrontCamera = !isFrontCamera;
                    const newFacingMode = isFrontCamera ? 'user' : 'environment';
                    stream.getTracks().forEach(track => track.stop());
                    
                    navigator.mediaDevices.getUserMedia({
                      video: { facingMode: newFacingMode }
                    }).then(newStream => {
                      stream = newStream;
                      videoEl.srcObject = newStream;
                    });
                  };
                  
                  // Capturar foto
                  document.getElementById('captureBtn').onclick = () => {
                    canvasEl.width = videoEl.videoWidth;
                    canvasEl.height = videoEl.videoHeight;
                    canvasEl.getContext('2d').drawImage(videoEl, 0, 0);
                    
                    canvasEl.toBlob(blob => {
                      const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
                      setImagem(file);
                      
                      // Limpa tudo
                      stream.getTracks().forEach(track => track.stop());
                      modalDiv.remove();
                    }, 'image/jpeg');
                  };
                  
                  // Cancelar
                  document.getElementById('cancelBtn').onclick = () => {
                    stream.getTracks().forEach(track => track.stop());
                    modalDiv.remove();
                  };
                })
                .catch(err => {
                  console.error('Erro ao acessar a câmera:', err);
                  // Se falhar, abre o input file normal
                  document.getElementById('fileInput').click();
                });
              }}
              className="button-primary px-4 py-2 rounded flex items-center gap-2"
              title="Tirar foto com a câmera"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Câmera
            </button>
          </div>
          <textarea
            placeholder="Digite o texto do cartão (ex: Quero água)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
                className="input-field w-full"
          />
          <button
            onClick={handleCriarCartao}
                className="button-primary px-4 py-2 rounded"
          >
            Criar Cartão
          </button>
        </div>

        <div className="space-y-4">
              <h2 className="font-semibold text-white">Prévia:</h2>
          {imagem && texto && (
                <div className="preview-card">
                  <img 
                    src={imagem ? URL.createObjectURL(imagem) : ''} 
                    alt="Prévia" 
                    className="w-full h-48 object-cover" 
                  />
                  <div className="preview-text p-4">{texto}</div>
            </div>
          )}
        </div>
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
            className="preview-card relative group"
          >
            <div
              onClick={() => lerTexto(cartao.texto)}
              title="Clique para ouvir"
              className="w-full h-full"
            >
            <img src={cartao.imagem} alt="Cartão" className="w-full h-48 object-cover" />
              <div className="preview-text p-4">{cartao.texto}</div>
            </div>
            
            <div className="card-controls hidden group-hover:flex">
              <button
                onClick={() => {
                  setCartaoParaMover(cartao);
                  setMostrarModalMover(true);
                }}
                className="control-button"
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
                className="control-button control-button-danger"
                title="Excluir cartão"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para mover cartão */}
      {mostrarModalMover && cartaoParaMover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content p-6 max-w-md w-full">
            <h3 className="modal-title text-lg mb-4">Mover cartão para sessão:</h3>
            <div className="space-y-2">
              {sessoes
                .filter(sessao => sessao.id !== sessaoAtual)
                .map(sessao => (
                  <button
                    key={sessao.id}
                    onClick={() => handleMoverCartao(cartaoParaMover.id, sessao.id)}
                    className="w-full text-left p-2 hover:bg-gray-100 rounded modal-text"
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
              className="mt-4 w-full modal-button-secondary p-2 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmação para excluir cartão */}
      {mostrarModalExcluir && cartaoParaExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content p-6 max-w-md w-full">
            <h3 className="modal-title text-lg mb-4">Confirmar exclusão</h3>
            <p className="modal-text mb-6">
              Tem certeza que deseja excluir o cartão "{cartaoParaExcluir.texto}"? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleExcluirCartao(cartaoParaExcluir.id)}
                className="flex-1 modal-button-primary p-2 rounded"
              >
                Excluir
              </button>
              <button
                onClick={() => {
                  setMostrarModalExcluir(false);
                  setCartaoParaExcluir(null);
                }}
                className="flex-1 modal-button-secondary p-2 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação para excluir sessão */}
      {mostrarModalExcluirSessao && sessaoParaExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content p-6 max-w-md w-full">
            <h3 className="modal-title text-lg mb-4">Confirmar exclusão da sessão</h3>
            <p className="modal-text mb-6">
              Tem certeza que deseja excluir a sessão "{sessaoParaExcluir.nome}"?<br/>
              Os cartões desta sessão serão movidos para a sessão Principal.<br/>
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleExcluirSessao(sessaoParaExcluir.id)}
                className="flex-1 modal-button-primary p-2 rounded"
              >
                Excluir
              </button>
              <button
                onClick={() => {
                  setMostrarModalExcluirSessao(false);
                  setSessaoParaExcluir(null);
                }}
                className="flex-1 modal-button-secondary p-2 rounded"
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
