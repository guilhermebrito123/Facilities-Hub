export const MIN_EFETIVO_ESCALA_12X36 = 4;

interface PostoEfetivoInfo {
  escala?: string | null;
  efetivo_planejado?: number | null;
}

const isEscala12x36 = (escala?: string | null) => {
  if (!escala) return false;
  return escala.trim().toLowerCase() === "12x36";
};

export const getEfetivoPlanejadoAjustado = (posto: PostoEfetivoInfo): number => {
  const baseEfetivo = posto.efetivo_planejado && posto.efetivo_planejado > 0 ? posto.efetivo_planejado : 1;
  if (isEscala12x36(posto.escala)) {
    return Math.max(baseEfetivo, MIN_EFETIVO_ESCALA_12X36);
  }
  return baseEfetivo;
};

export const getCoberturaParaPosto = (colaboradoresAtivos: number, posto: PostoEfetivoInfo) => {
  const efetivoNecessario = getEfetivoPlanejadoAjustado(posto);
  const efetivoConsiderado = Math.min(colaboradoresAtivos, efetivoNecessario);

  return {
    efetivoNecessario,
    efetivoConsiderado,
    estaCoberto: colaboradoresAtivos >= efetivoNecessario,
  };
};
