const PREFIX = "[multi-uploader]";
const getLog = (str: string) => `${PREFIX} ${str}`;

const logger = {
  info: (str: string) => {
    console.log(getLog(str));
  },

  warn: (str: string) => {
    console.warn(getLog(str));
  },

  error: (str: string) => {
    console.error(getLog(str));
  },
};

export default logger;
