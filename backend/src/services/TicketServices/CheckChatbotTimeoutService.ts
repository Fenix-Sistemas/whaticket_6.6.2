import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import UpdateTicketService from "./UpdateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import Contact from "../../models/Contact";

const CheckChatbotTimeoutService = async (companyId: number) => {
  try {
    logger.info(`[CHATBOT TIMEOUT] Verificando tickets com timeout para companyId: ${companyId}`);

    // Procurar todos os tickets em chatbot sem fila
    const ticketsWithTimeout = await Ticket.findAll({
      where: {
        status: "open",
        queueId: null,
        chatbot: true,
        companyId: companyId
      },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "number", "name"]
        }
      ]
    });

    logger.info(`[CHATBOT TIMEOUT] Encontrados ${ticketsWithTimeout.length} tickets em chatbot sem fila`);

    for (const ticket of ticketsWithTimeout) {
      try {
        const ticketTraking = await TicketTraking.findOne({
          where: {
            ticketId: ticket.id
          }
        });

        if (ticketTraking && ticketTraking.chatbotAt !== null) {
          // Procurar a instância do WhatsApp
          const whatsapp = await ShowWhatsAppService(ticket.whatsappId, companyId);
          
          if (whatsapp) {
            const { chatbotInactivityTimeout, chatbotInactivityMessage } = whatsapp;

            if (chatbotInactivityTimeout && Number(chatbotInactivityTimeout) > 0) {
              const now = new Date();
              const chatbotAtTime = new Date(ticketTraking.chatbotAt);
              // Usar o timeout do banco em minutos, converter para milissegundos
              const timeoutMs = Number(chatbotInactivityTimeout) * 60 * 1000;
              const timeDiff = now.getTime() - chatbotAtTime.getTime();

              if (timeDiff >= timeoutMs) {
                logger.info(`[CHATBOT TIMEOUT] Timeout atingido para ticket ${ticket.id} - timeDiff: ${timeDiff}ms, timeout: ${timeoutMs}ms`);

                // Enviar mensagem de timeout ANTES de fechar o ticket
                if (chatbotInactivityMessage && chatbotInactivityMessage.length > 0) {
                  try {
                    const body = formatBody(chatbotInactivityMessage, ticket.contact);
                    const wbot = await ShowWhatsAppService(ticket.whatsappId, companyId);
                    
                    if (wbot) {
                      await SendWhatsAppMessage({
                        body,
                        ticket
                      });
                      logger.info(`[CHATBOT TIMEOUT] Mensagem de timeout enviada para ticket ${ticket.id}`);
                    }
                  } catch (err) {
                    logger.error(`[CHATBOT TIMEOUT] Erro ao enviar mensagem de timeout para ticket ${ticket.id}: ${err}`);
                  }
                }

                // Fechar ticket com fromMe: true para evitar mensagem de encerramento normal
                await UpdateTicketService({
                  ticketData: {
                    status: "closed",
                    queueId: null,
                    chatbot: false,
                    fromMe: true
                  },
                  ticketId: ticket.id,
                  companyId: ticket.companyId
                });

                logger.info(`[CHATBOT TIMEOUT] Ticket ${ticket.id} fechado por timeout`);
              }
            }
          }
        }
      } catch (err) {
        logger.error(`[CHATBOT TIMEOUT] Erro ao processar timeout para ticket ${ticket.id}: ${err}`);
      }
    }
  } catch (err) {
    logger.error(`[CHATBOT TIMEOUT] Erro na verificação de timeout: ${err}`);
  }
};

export default CheckChatbotTimeoutService;
