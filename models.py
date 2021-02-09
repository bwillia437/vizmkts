from otree.api import (
    models, BaseConstants
)
from otree_markets import models as markets_models
from otree_markets.exchange.base import Order, OrderStatusEnum
from .configmanager import MarketConfig
import math
import itertools


class Constants(BaseConstants):
    name_in_url = 'otree_visual_markets'
    players_per_group = None
    num_rounds = 99 

class Subsession(markets_models.Subsession):

    @property
    def config(self):
        config_name = self.session.config['session_config_file']
        return MarketConfig.get(config_name, self.round_number)

    def do_grouping(self):
        ppg = self.config.players_per_group
        # if ppg is None, just use the default grouping where everyone is in one group
        if not ppg:
            return
        group_matrix = []
        players = self.get_players()
        for i in range(0, len(players), ppg):
            group_matrix.append(players[i:i+ppg])
        self.set_group_matrix(group_matrix)

    def creating_session(self):
        if self.round_number > self.config.num_rounds:
            return
        self.do_grouping()
        return super().creating_session()
    

class Group(markets_models.Group):

    def period_length(self):
        return self.subsession.config.period_length

    # def _on_enter_event(self, event):
    #     '''handle an enter message sent from the frontend
        
    #     if the order is valid and can be entered, first cancel all of this player's other active orders on the same side.
    #     this ensures that players can only ever have one active order of each type.
    #     '''
    #     enter_msg = event.value
    #     asset_name = markets_models.SINGLE_ASSET_NAME

    #     player = self.get_player(enter_msg['pcode'])
    #     if player.check_available(enter_msg['is_bid'], enter_msg['price'], enter_msg['volume'], asset_name):
    #         self.try_cancel_active_order(enter_msg['pcode'], enter_msg['is_bid'])
        
    #     super()._on_enter_event(event)
    
    # def _on_accept_event(self, event):
    #     '''handle an accept message sent from the frontend
        
    #     if the order can be accepted, first cancel all of this player's other active orders on the same side as the pseudo-order they're entering with their accept.
    #     this ensures that players can only ever have one active order of each type.
    #     '''
    #     accepted_order_dict = event.value
    #     asset_name = markets_models.SINGLE_ASSET_NAME

    #     sender_pcode = event.participant.code
    #     player = self.get_player(sender_pcode)

    #     if player.check_available(not accepted_order_dict['is_bid'], accepted_order_dict['price'], accepted_order_dict['volume'], asset_name):
    #         self.try_cancel_active_order(sender_pcode, not accepted_order_dict['is_bid'])
        
    #     super()._on_accept_event(event)
    
    def confirm_enter(self, order):
        player = self.get_player(order.pcode)
        player.refresh_from_db()
        exchange = self.exchanges.get()

        if order.is_bid:
            if player.current_bid:
                exchange.cancel_order(player.current_bid.id)
            player.current_bid = order
            player.save()
        else:
            if player.current_ask:
                exchange.cancel_order(player.current_ask.id)
            player.current_ask = order
            player.save()

        super().confirm_enter(order)

    def confirm_trade(self, trade):
        exchange = self.exchanges.get()
        for order in itertools.chain(trade.making_orders.all(), [trade.taking_order]):
            player = self.get_player(order.pcode)
            player.refresh_from_db()

            # if the order from this trade is the current order for that player, update their current order to None.
            # if the order from this trade is NOT the current order for that player, cancel it.
            # the exception to this is if the price on the trade order and current order are the same, we assume the current
            # order is a partially completed order from this trade and don't cancel it
            if order.is_bid and player.current_bid:
                if order.id == player.current_bid.id:
                    player.current_bid = None
                    player.save()
                elif order.price != player.current_bid.price:
                    exchange.cancel_order(player.current_bid.id)

            if not order.is_bid and player.current_ask:
                if order.id == player.current_ask.id:
                    player.current_ask = None
                    player.save()
                elif order.price != player.current_ask.price:
                    exchange.cancel_order(player.current_ask.id)

        super().confirm_trade(trade)
    
    def confirm_cancel(self, order):
        player = self.get_player(order.pcode)
        player.refresh_from_db()
        if order.is_bid:
            player.current_bid = None
        else:
            player.current_ask = None
        player.save()

        super().confirm_cancel(order)
        
   
    # def try_cancel_active_order(self, pcode, is_bid):
    #     '''try to cancel active orders owned by players with pcode `pcode`, of type `is_bid` and in the
    #     '''
    #     exchange = self.exchanges.get()
    #     try:
    #         old_order = exchange.orders.get(pcode=pcode, is_bid=is_bid, status=OrderStatusEnum.ACTIVE)
    #     except Order.DoesNotExist: 
    #         pass
    #     else:
    #         exchange.cancel_order(old_order.id)


class Player(markets_models.Player):

    current_bid = models.ForeignKey(Order, null=True, on_delete=models.CASCADE, related_name="+")
    current_ask = models.ForeignKey(Order, null=True, on_delete=models.CASCADE, related_name="+")

    def asset_endowment(self):
        config = self.subsession.config
        endowment = config.x_endowment
        if isinstance(endowment, list):
            endowment = endowment[self.id_in_group % len(endowment)]
        return endowment * config.x_currency_scale
    
    def cash_endowment(self):
        config = self.subsession.config
        endowment = config.y_endowment
        if isinstance(endowment, list):
            endowment = endowment[self.id_in_group % len(endowment)]
        return endowment * config.y_currency_scale