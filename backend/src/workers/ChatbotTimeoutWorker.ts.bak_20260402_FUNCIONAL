import { Op } from "sequelize";
import Ticket from "../models/Ticket";
import TicketTraking from "../models/TicketTraking";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import formatBody from "../helpers/Mustache";
import { getWbot } from "../libs/wbot";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { verifyMessage } from "../services/WbotServices/wbotMessageListener";

let timeoutWorkerRunning = false;

export const startChatbotTimeoutWorker = () => {
  if (timeoutWorkerRunning) {
    logger.info("[ChatbotTimeoutWorker] Worker ja esta rodando, pulando...");
    return;
  }

  timeoutWorkerRunning = true;
  logger.info("[ChatbotTimeoutWorker] Iniciando worker de timeout de inatividade do chatbot...");

  // Executar verificacao a cada 30 segundos
  setInterval(async () => {
    try {
      await checkChatbotInactivityTimeout();
    } catch (error) {
      logger.error("[ChatbotTimeoutWorker] Erro ao verificar timeout:", error);
    }
  }, 30000); // 30 segundos
};

const checkChatbotInactivityTimeout = async () => {
  try {
    // Buscar todos os tickets sem fila, sem usuario, nao grupo (aguardando escolha de fila)
    const tickets = await Ticket.findAll({
      where: {
        status: { [Op.in]: ["open", "pending"] },
        queueId: null,
        userId: null,
        isGroup: false
      },
      include: [
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["id", "chatbotInactivityTimeout", "chatbotInactivityMessage"]
        },
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "email", "profilePicUrl"]
        }
      ]
    });

    if (tickets.length === 0) return;

    logger.info(`[ChatbotTimeoutWorker] Verificando ${tickets.length} tickets aguardando escolha de fila`);

    for (const ticket of tickets) {
      try {
        // Verificar se timeout esta configurado
        if (!ticket.whatsapp) continue;
        if (!ticket.whatsapp.chatbotInactivityTimeout || Number(ticket.whatsapp.chatbotInactivityTimeout) <= 0) continue;

        // Tentar usar chatbotAt do TicketTraking, senao usar updatedAt do ticket
        let referenceTime: Date;

        const ticketTraking = await TicketTraking.findOne({
          where: {
            ticketId: ticket.id,
            finishedAt: null
          },
          order: [["id", "DESC"]]
        });

        if (ticketTraking && ticketTraking.chatbotAt) {
          referenceTime = new Date(ticketTraking.chatbotAt);
        } else {
          // Fallback: usar updatedAt do ticket (ultima atividade)
          referenceTime = new Date(ticket.updatedAt);
        }

        const now = new Date();
        const timeoutMs = Number(ticket.whatsapp.chatbotInactivityTimeout) * 60 * 1000;
        const timeDiff = now.getTime() - referenceTime.getTime();

        logger.info(
          `[ChatbotTimeoutWorker] Ticket ${ticket.id}: ref=${referenceTime.toISOString()}, diff=${Math.round(timeDiff/1000)}s, timeout=${Math.round(timeoutMs/1000)}s, atingido=${timeDiff >= timeoutMs}`
        );

        if (timeDiff >= timeoutMs) {
          logger.info(`[ChatbotTimeoutWorker] TIMEOUT ATINGIDO para ticket ${ticket.id}. Encerrando...`);

          // Enviar mensagem de timeout
          if (ticket.whatsapp.chatbotInactivityMessage && ticket.whatsapp.chatbotInactivityMessage.trim() !== "") {
            try {
              const body = formatBody(`\u200e${ticket.whatsapp.chatbotInactivityMessage}`, ticket.contact);
              const wbot = await getWbot(ticket.whatsappId);

              if (wbot) {
                const sentMessage = await wbot.sendMessage(
                  `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
                  { text: body }
                );
                // Registrar mensagem no Whaticket para aparecer no painel
                await verifyMessage(sentMessage, ticket, ticket.contact);
                logger.info(`[ChatbotTimeoutWorker] Mensagem de timeout enviada e registrada para ticket ${ticket.id}`);
              }
            } catch (sendError) {
              logger.error(`[ChatbotTimeoutWorker] Erro ao enviar mensagem para ticket ${ticket.id}:`, sendError);
            }
          }

          // Fechar ticket
          try {
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
            logger.info(`[ChatbotTimeoutWorker] Ticket ${ticket.id} encerrado com sucesso`);

            // Emitir notificacao WebSocket
            try {
              const io = getIO();
              // Emitir delete para todos os canais relevantes
              io.to(`company-${ticket.companyId}-open`)
                .to(`company-${ticket.companyId}-pending`)
                .to(`company-${ticket.companyId}-mainchannel`)
                .to(ticket.id.toString())
                .emit(`company-${ticket.companyId}-ticket`, {
                  action: "delete",
                  ticketId: ticket.id
                });
            } catch (ioError) {
              logger.warn(`[ChatbotTimeoutWorker] Erro ao emitir WebSocket para ticket ${ticket.id}:`, ioError);
            }
          } catch (updateError) {
            logger.error(`[ChatbotTimeoutWorker] Erro ao atualizar ticket ${ticket.id}:`, updateError);
          }
        }
      } catch (error) {
        logger.error(`[ChatbotTimeoutWorker] Erro ao processar ticket:`, error);
      }
    }
  } catch (error) {
    logger.error("[ChatbotTimeoutWorker] Erro geral:", error);
  }
};
