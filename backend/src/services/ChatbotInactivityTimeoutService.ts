import { Op } from "sequelize";
import TicketTraking from "../models/TicketTraking";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import User from "../models/User";
import formatBody from "../helpers/Mustache";
import { getWbot } from "../libs/wbot";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import CreateMessageService from "./MessageServices/CreateMessageService";

const ChatbotInactivityTimeoutService = async () => {
  try {
    logger.info("[ChatbotInactivityTimeout] Iniciando verificação de timeout...");
    
    // Buscar todos os TicketTrakings com chatbotAt setado
    const ticketTrakings = await TicketTraking.findAll({
      where: {
        chatbotAt: {
          [Op.ne]: null
        },
        finishedAt: null
      },
      include: [
        {
          model: Ticket,
          as: "ticket",
          required: true,
          where: {
            status: ["open", "pending"],
            queueId: null,
            userId: null,
            chatbot: true,
            isGroup: false
          },
          include: [
            {
              model: Contact,
              as: "contact",
              attributes: ["id", "name", "number", "email", "profilePicUrl"]
            },
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "email"]
            }
          ]
        }
      ]
    });
    logger.info(
      `[ChatbotInactivityTimeout] Encontrados ${ticketTrakings.length} ticketTrakings com chatbotAt`
    );
    for (const ticketTraking of ticketTrakings) {
      try {
        const ticket = ticketTraking.ticket;
        
        if (!ticket) {
          logger.info(`[ChatbotInactivityTimeout] TicketTraking ${ticketTraking.id}: ticket não encontrado`);
          continue;
        }
        // Carregar whatsapp e contact
        const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
        const contact = await Contact.findByPk(ticket.contactId);
        if (!whatsapp || !contact) {
          logger.info(`[ChatbotInactivityTimeout] Ticket ${ticket.id}: whatsapp ou contact não encontrado`);
          continue;
        }
        // Verificar se timeout está configurado
        if (!whatsapp.chatbotInactivityTimeout || whatsapp.chatbotInactivityTimeout <= 0) {
          logger.info(`[ChatbotInactivityTimeout] Ticket ${ticket.id}: timeout não configurado`);
          continue;
        }
        const now = new Date();
        const chatbotAtTime = new Date(ticketTraking.chatbotAt);
        const timeoutMs = Number(whatsapp.chatbotInactivityTimeout) * 60 * 1000;
        const timeDiff = now.getTime() - chatbotAtTime.getTime();
        logger.info(
          `[ChatbotInactivityTimeout] Ticket ${ticket.id}: timeDiff=${timeDiff}ms, timeoutMs=${timeoutMs}ms`
        );
        if (timeDiff >= timeoutMs) {
          logger.info(
            `[ChatbotInactivityTimeout] Timeout atingido para ticket ${ticket.id}. Encerrando...`
          );
          
          const body = formatBody(whatsapp.chatbotInactivityMessage, contact);
          
          try {
            // Enviar mensagem de timeout via WhatsApp
            const wbot = await getWbot(whatsapp.id);
            const sentMessage = await wbot.sendMessage(`${contact.number}@${ticket.isGroup ? "g" : "c"}.us`, {
              text: body
            });
            logger.info(`[ChatbotInactivityTimeout] Mensagem enviada para ticket ${ticket.id}`);
            
            // Gravar mensagem no histórico do ticket
            try {
              const messageData = {
                id: sentMessage?.key?.id || `timeout_${ticket.id}_${Date.now()}`,
                ticketId: ticket.id,
                contactId: undefined, // Mensagem do sistema, não de um contato específico
                body: body,
                fromMe: true, // Mensagem enviada pelo sistema
                mediaType: "text",
                read: true,
                quotedMsgId: null,
                ack: 2, // Mensagem entregue
                remoteJid: sentMessage?.key?.remoteJid || `${contact.number}@${ticket.isGroup ? "g" : "c"}.us`,
                participant: null,
                dataJson: JSON.stringify({
                  key: sentMessage?.key || { id: `timeout_${ticket.id}_${Date.now()}` },
                  message: { conversation: body },
                  messageTimestamp: Date.now() / 1000,
                  status: 2
                })
              };
              
              await CreateMessageService({ messageData, companyId: ticket.companyId });
              logger.info(`[ChatbotInactivityTimeout] Mensagem gravada no histórico do ticket ${ticket.id}`);
            } catch (messageError) {
              logger.error(`[ChatbotInactivityTimeout] Erro ao gravar mensagem para ticket ${ticket.id}:`, messageError);
            }
          } catch (sendError) {
            logger.error(`[ChatbotInactivityTimeout] Erro ao enviar mensagem para ticket ${ticket.id}:`, sendError);
          }
          
          try {
            // Marcar como finalizado
            await ticketTraking.update({
              finishedAt: new Date(),
              rated: true
            });
            // Fechar ticket
            await ticket.update({
              status: "closed"
            });
            logger.info(`[ChatbotInactivityTimeout] Ticket ${ticket.id} encerrado com sucesso`);
            
            // Emitir notificação WebSocket para atualizar frontend
            try {
              const io = getIO();
              // Recarregar ticket com todas as associações para enviar dados completos
              const updatedTicket = await Ticket.findByPk(ticket.id, {
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: ["id", "name", "number", "email", "profilePicUrl"]
                  },
                  {
                    model: User,
                    as: "user",
                    attributes: ["id", "name", "email"]
                  }
                ]
              });
              
              io.to(`company-${ticket.companyId}-mainchannel`).emit(`company-${ticket.companyId}-ticket`, {
                action: "update",
                ticket: updatedTicket
              });
              logger.info(`[ChatbotInactivityTimeout] WebSocket notificação enviada para ticket ${ticket.id}`);
            } catch (ioError) {
              logger.warn(`[ChatbotInactivityTimeout] Erro ao emitir WebSocket para ticket ${ticket.id}:`, ioError);
            }
          } catch (updateError) {
            logger.error(`[ChatbotInactivityTimeout] Erro ao atualizar ticket ${ticket.id}:`, updateError);
          }
        }
      } catch (error) {
        logger.error(`[ChatbotInactivityTimeout] Erro ao processar ticketTraking:`, error);
      }
    }
  } catch (error) {
    logger.error("[ChatbotInactivityTimeout] Erro geral:", error);
  }
};
export default ChatbotInactivityTimeoutService;
