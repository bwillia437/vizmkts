from otree.api import (
    models, BaseConstants
)
from otree_markets import models as markets_models
from otree_markets.exchange.base import Order, OrderStatusEnum
from .configmanager import MarketConfig
import math


class Constants(BaseConstants):
    name_in_url = 'otree_visual_markets'
    players_per_group = None
    num_rounds = 99 

class Subsession(markets_models.Subsession):

    @property
    def config(self):
        config_name = self.session.config['session_config_file']
        return MarketConfig.get(config_name, self.round_number)
    
    def allow_short(self):
        return self.config.allow_short

    def creating_session(self):
        if self.round_number > self.config.num_rounds:
            return
        return super().creating_session()
    

class Group(markets_models.Group):

    def _on_enter_event(self, event):
        '''handle an enter message sent from the frontend
        
        if the order is valid and can be entered, first cancel all of this player's other active orders on the same side.
        this ensures that players can only ever have one active order of each type.
        '''
        enter_msg = event.value
        asset_name = markets_models.SINGLE_ASSET_NAME

        player = self.get_player(enter_msg['pcode'])
        if player.check_available(enter_msg['is_bid'], enter_msg['price'], enter_msg['volume'], asset_name):
            self.try_cancel_active_order(enter_msg['pcode'], enter_msg['is_bid'])
        
        super()._on_enter_event(event)
    
    def _on_accept_event(self, event):
        '''handle an accept message sent from the frontend
        
        if the order can be accepted, first cancel all of this player's other active orders on the same side as the pseudo-order they're entering with their accept.
        this ensures that players can only ever have one active order of each type.
        '''
        accepted_order_dict = event.value
        asset_name = markets_models.SINGLE_ASSET_NAME

        sender_pcode = event.participant.code
        player = self.get_player(sender_pcode)

        if player.check_available(not accepted_order_dict['is_bid'], accepted_order_dict['price'], accepted_order_dict['volume'], asset_name):
            self.try_cancel_active_order(sender_pcode, not accepted_order_dict['is_bid'])
        
        super()._on_accept_event(event)
   
    def try_cancel_active_order(self, pcode, is_bid):
        '''try to cancel active orders owned by players with pcode `pcode`, of type `is_bid` and in the
        '''
        exchange = self.exchanges.get()
        try:
            old_order = exchange.orders.get(pcode=pcode, is_bid=is_bid, status=OrderStatusEnum.ACTIVE)
        except Order.DoesNotExist: 
            pass
        else:
            exchange.cancel_order(old_order.id)


class Player(markets_models.Player):

    def asset_endowment(self):
        return self.subsession.config.x_endowment
    
    def cash_endowment(self):
        return self.subsession.config.y_endowment