export const currency = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const number = new Intl.NumberFormat('bg-BG');

export const dateTime = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatOptionSpec(option) {
  if (option.spec) {
    return option.spec;
  }

  if (option.cpu) {
    return `${number.format(option.cpu)} capacity units`;
  }

  if (option.ram) {
    return `${number.format(option.ram)} GB RAM`;
  }

  if (option.storage) {
    return option.storage >= 1024
      ? `${number.format(option.storage / 1024)} PB`
      : `${number.format(option.storage)} TB`;
  }

  if (option.io) {
    return `${number.format(option.io)} GbE`;
  }

  if (option.security) {
    return `Ниво ${option.security}`;
  }

  if (option.cooling) {
    return `Ниво ${option.cooling}`;
  }

  return `${option.watts.toFixed(1)} kW`;
}
